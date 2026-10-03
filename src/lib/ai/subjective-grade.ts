import mongoose from "mongoose";
import { ActionError } from "@/lib/auth-guards";
import { maskId } from "@/lib/debug";
import { Attempt } from "@/models/Attempt";
import { Question } from "@/models/Question";
import { Result } from "@/models/Result";

/** Temporary Suggest-with-AI debug. Safe metadata only. Remove later. */
export function aiGradeLog(line: string, extra?: Record<string, string | number | boolean>) {
  const suffix = extra
    ? ` ${Object.entries(extra)
        .map(([key, value]) => `${key}=${value}`)
        .join(" ")}`
    : "";
  console.log(`[AI-GRADING] ${line}${suffix}`);
}

function fail(stage: string, message: string): never {
  aiGradeLog(`ERROR_STAGE: ${stage}`);
  throw new ActionError(message);
}

export const AI_GRADING_NOT_CONFIGURED = "AI grading is not configured.";
export const AI_GRADING_TIMEOUT_MS = 15_000;
export const AI_GRADING_FEEDBACK_MAX = 2000;
export const AI_GRADING_RATE_WINDOW_MS = 60_000;
export const AI_GRADING_RATE_MAX = 6;

export type SubjectiveGradeContext = {
  attemptId: string;
  questionId: string;
  prompt: string;
  studentAnswer: string;
  maxMarks: number;
  rubric: string;
};

export type SubjectiveGradeSuggestion = {
  suggestedMarks: number;
  feedback: string;
};

type FetchLike = typeof fetch;

const rateHits = new Map<string, number[]>();
let testFetch: FetchLike | null = null;

export function isAiGradingConfigured() {
  return Boolean(process.env.AI_GRADING_API_KEY?.trim());
}

export function setSubjectiveGradeFetchForTests(fn: FetchLike | null) {
  testFetch = fn;
}

export function resetAiGradingRateLimitForTests() {
  rateHits.clear();
}

export function assertAiGradingRateLimit(adminId: string) {
  const now = Date.now();
  const recent = (rateHits.get(adminId) ?? []).filter(
    (ts) => now - ts < AI_GRADING_RATE_WINDOW_MS,
  );
  if (recent.length >= AI_GRADING_RATE_MAX) {
    fail(
      "RATE_LIMIT",
      "Too many AI grading requests. Wait a minute and try again.",
    );
  }
  recent.push(now);
  rateHits.set(adminId, recent);
}

export function clampSuggestedMarks(value: number, maxMarks: number) {
  if (!Number.isFinite(value) || !Number.isFinite(maxMarks) || maxMarks < 0) {
    fail("OUTPUT_VALIDATION", "AI grading returned invalid marks.");
  }
  const clamped = Math.min(maxMarks, Math.max(0, value));
  return Math.round(clamped * 2) / 2;
}

export function parseSubjectiveGradeSuggestion(
  raw: unknown,
  maxMarks: number,
): SubjectiveGradeSuggestion {
  aiGradeLog("OUTPUT: validation started");
  if (!raw || typeof raw !== "object") {
    fail("OUTPUT_VALIDATION", "AI grading returned an invalid response.");
  }
  const record = raw as Record<string, unknown>;
  const marksRaw = record.suggestedMarks ?? record.marks;
  const marks = typeof marksRaw === "number" ? marksRaw : Number(marksRaw);
  if (!Number.isFinite(marks)) {
    fail("OUTPUT_VALIDATION", "AI grading returned invalid marks.");
  }
  const feedbackRaw = record.feedback;
  if (typeof feedbackRaw !== "string") {
    fail("OUTPUT_VALIDATION", "AI grading returned invalid feedback.");
  }
  const suggestion = {
    suggestedMarks: clampSuggestedMarks(marks, maxMarks),
    feedback: feedbackRaw.trim().slice(0, AI_GRADING_FEEDBACK_MAX),
  };
  aiGradeLog("OUTPUT: validation passed", {
    suggestedMarks: suggestion.suggestedMarks,
    feedbackLength: suggestion.feedback.length,
  });
  return suggestion;
}

export async function getSubjectiveGradeContext(
  attemptId: string,
  questionId: string,
): Promise<SubjectiveGradeContext> {
  aiGradeLog("ATTEMPT: lookup started", { attemptId: maskId(attemptId) });
  aiGradeLog("QUESTION: lookup started", { questionId: maskId(questionId) });
  if (
    !mongoose.Types.ObjectId.isValid(attemptId) ||
    !mongoose.Types.ObjectId.isValid(questionId)
  ) {
    fail("VALIDATION", "Question not available for AI grading.");
  }

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    fail("DATABASE", "Attempt not found.");
  }
  aiGradeLog("ATTEMPT: found", { status: attempt.status });
  if (attempt.status === "in_progress") {
    fail("VALIDATION", "Cannot grade an in-progress attempt.");
  }
  aiGradeLog(`ATTEMPT_STATUS: ${attempt.status}`);

  const result = await Result.findOne({ attemptId: attempt._id });
  if (!result) {
    fail("DATABASE", "Result not found for this attempt.");
  }

  const snapshot = (result.questions ?? []).find(
    (q) => q.questionId.toString() === questionId,
  );
  if (!snapshot) {
    fail("DATABASE", "Question not found in this result.");
  }
  aiGradeLog("QUESTION: found", { questionType: snapshot.type });
  aiGradeLog(`QUESTION_TYPE: ${snapshot.type}`);
  if (snapshot.type !== "subjective") {
    fail("VALIDATION", "AI grading is only available for subjective questions.");
  }

  const studentAnswer = (snapshot.textAnswer ?? "").trim();
  if (!studentAnswer) {
    aiGradeLog("ANSWER: empty", { answerLength: 0 });
    fail("VALIDATION", "This question has no student answer to grade.");
  }
  aiGradeLog("ANSWER: non-empty", { answerLength: studentAnswer.length });
  aiGradeLog(`MAX_MARKS: ${snapshot.points}`);

  const question = await Question.findById(questionId).select("explanation prompt");
  const prompt = (snapshot.prompt || question?.prompt || "").trim();
  if (!prompt) {
    fail("VALIDATION", "Question prompt is missing.");
  }
  const rubric = (question?.explanation ?? "").trim();
  aiGradeLog(rubric ? "RUBRIC: available" : "RUBRIC: missing", {
    hasRubric: Boolean(rubric),
  });

  return {
    attemptId,
    questionId,
    prompt,
    studentAnswer,
    maxMarks: snapshot.points,
    rubric,
  };
}

export async function requestSubjectiveGradeSuggestion(
  input: SubjectiveGradeContext,
): Promise<SubjectiveGradeSuggestion> {
  const apiKey = process.env.AI_GRADING_API_KEY?.trim();
  if (!apiKey) {
    aiGradeLog("PROVIDER: API key missing");
    fail("PROVIDER_REQUEST", AI_GRADING_NOT_CONFIGURED);
  }

  const model = process.env.AI_GRADING_MODEL?.trim() || "gpt-4o-mini";
  const baseUrl = (
    process.env.AI_GRADING_BASE_URL?.trim() || "https://api.openai.com"
  ).replace(/\/$/, "");
  const providerUrl = `${baseUrl}/v1/chat/completions`;
  let providerHost = "unknown";
  let providerPath = "/v1/chat/completions";
  try {
    const parsedUrl = new URL(providerUrl);
    providerHost = parsedUrl.hostname;
    providerPath = parsedUrl.pathname;
  } catch {
    providerHost = "invalid-url";
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_GRADING_TIMEOUT_MS);
  const fetchFn = testFetch ?? fetch;
  const providerStarted = Date.now();
  aiGradeLog("PROVIDER: request started", {
    host: providerHost,
    path: providerPath,
    model,
    maxMarks: input.maxMarks,
    answerLength: input.studentAnswer.length,
    hasRubric: Boolean(input.rubric),
  });

  try {
    const response = await fetchFn(providerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are a grading assistant. Suggest marks and short feedback for a human reviewer. Do not invent facts beyond the question and rubric. If the answer is ambiguous, say so in the feedback. Return JSON only: {\"suggestedMarks\": number, \"feedback\": string}.",
          },
          {
            role: "user",
            content: JSON.stringify({
              prompt: input.prompt,
              studentAnswer: input.studentAnswer,
              maximumMarks: input.maxMarks,
              rubric: input.rubric || "No additional rubric provided.",
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    const providerMs = Date.now() - providerStarted;
    aiGradeLog("PROVIDER: response received");
    aiGradeLog(`PROVIDER_STATUS: ${response.status}`);
    aiGradeLog(`PROVIDER_DURATION_MS: ${providerMs}`, {
      host: providerHost,
      path: providerPath,
      model,
    });

    if (!response.ok) {
      if (response.status === 429) {
        fail("PROVIDER_RESPONSE", "AI grading is busy. Try again shortly.");
      }
      fail("PROVIDER_RESPONSE", "AI grading is unavailable right now.");
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content?.trim()) {
      fail("PROVIDER_RESPONSE", "AI grading returned an empty response.");
    }

    aiGradeLog("PROVIDER: response parsing started", {
      contentLength: content.length,
    });
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      fail("OUTPUT_VALIDATION", "AI grading returned an invalid response.");
    }

    return parseSubjectiveGradeSuggestion(parsed, input.maxMarks);
  } catch (error) {
    if (error instanceof ActionError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      aiGradeLog(`PROVIDER_DURATION_MS: ${Date.now() - providerStarted}`);
      fail("PROVIDER_REQUEST", "AI grading timed out. Try again.");
    }
    fail("PROVIDER_REQUEST", "AI grading is unavailable right now.");
  } finally {
    clearTimeout(timer);
  }
}
