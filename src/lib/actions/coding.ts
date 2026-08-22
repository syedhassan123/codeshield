"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionError, requireStudent } from "@/lib/auth-guards";
import { evaluateAgainstTests } from "@/lib/coding/evaluate";
import { CODING_RUN_COOLDOWN_MS } from "@/lib/coding/config";
import { assertValidCodingSource } from "@/lib/coding/security";
import { connectDB } from "@/lib/db";
import { createServerOp, debugLog, maskId } from "@/lib/debug";
import {
  ensureAttemptNotExpired,
  getOwnedAttempt,
} from "@/lib/exam/finalize";
import { recalculateResultScores } from "@/lib/exam/score";
import { Answer } from "@/models/Answer";
import { Assessment } from "@/models/Assessment";
import { CodingSubmission } from "@/models/CodingSubmission";
import { Question } from "@/models/Question";
import { Result } from "@/models/Result";
import { CODING_LANGUAGES } from "@/types/assessment";

const codingPayloadSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  language: z.enum(CODING_LANGUAGES),
  sourceCode: z.string().min(1).max(100_000),
});

const runCooldown = new Map<string, number>();

function assertRunCooldown(attemptId: string, questionId: string) {
  const key = `${attemptId}:${questionId}`;
  const last = runCooldown.get(key) ?? 0;
  const now = Date.now();
  if (now - last < CODING_RUN_COOLDOWN_MS) {
    throw new ActionError("Please wait before running again.");
  }
  runCooldown.set(key, now);
}

async function loadCodingContext(studentId: string, attemptId: string, questionId: string) {
  let attempt = await getOwnedAttempt(attemptId, studentId);
  attempt = await ensureAttemptNotExpired(attempt);
  if (attempt.status !== "in_progress") {
    throw new ActionError("This attempt is closed.");
  }

  const allowed = (attempt.questionIds || []).some(
    (id) => id.toString() === questionId,
  );
  if (!allowed) throw new ActionError("Question is not part of this attempt.");

  const question = await Question.findById(questionId);
  if (!question || question.type !== "coding") {
    throw new ActionError("Coding question not found.");
  }

  const assessment = await Assessment.findById(attempt.assessmentId);
  if (!assessment || assessment.status !== "published") {
    throw new ActionError("Assessment is not available.");
  }

  return { attempt, question, assessment };
}

export async function runCodingVisibleAction(raw: unknown) {
  const op = createServerOp({
    domain: "CODING",
    operation: "RUN_VISIBLE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    const data = codingPayloadSchema.parse(raw);
    await connectDB();

    const { attempt, question } = await loadCodingContext(
      session.user.id,
      data.attemptId,
      data.questionId,
    );
    op.allowed("student run visible tests");

    if (!question.codingLanguages.includes(data.language)) {
      throw new ActionError("Unsupported language for this question.");
    }

    assertValidCodingSource(data.sourceCode);
    assertRunCooldown(data.attemptId, data.questionId);

    const visible = (question.testCases || []).filter((t) => !t.isHidden);
    if (!visible.length) {
      throw new ActionError("No visible test cases configured.");
    }

    debugLog("CODING", "run_visible_start", {
      attemptId: maskId(data.attemptId),
      questionId: maskId(data.questionId),
      tests: visible.length,
    });

    const evaluation = await evaluateAgainstTests({
      language: data.language,
      sourceCode: data.sourceCode,
      tests: visible.map((t) => ({
        input: t.input,
        expectedOutput: t.expectedOutput,
        isHidden: false,
        weight: t.weight ?? 1,
      })),
      timeLimitMs: question.timeLimitMs || 3000,
      memoryLimitMb: question.memoryLimitMb || 256,
      revealOutputs: true,
      maxScore: question.points,
    });

    await Answer.findOneAndUpdate(
      {
        attemptId: attempt._id,
        questionId: question._id,
        studentId: session.user.id,
      },
      {
        $set: {
          textAnswer: data.sourceCode,
          selectedOptionKey: data.language,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    await CodingSubmission.findOneAndUpdate(
      {
        attemptId: attempt._id,
        questionId: question._id,
        kind: "run",
      },
      {
        $set: {
          studentId: session.user.id,
          assessmentId: attempt.assessmentId,
          language: data.language,
          sourceCode: data.sourceCode,
          kind: "run",
          status: evaluation.status,
          passedTests: evaluation.passedTests,
          totalTests: evaluation.totalTests,
          score: 0,
          maxScore: question.points,
          executionTimeMs: evaluation.executionTimeMs,
          visibleResults: evaluation.results.map((r) => ({
            index: r.index,
            passed: r.passed,
            status: r.status,
            timeMs: r.timeMs,
            message: r.message,
          })),
          finalized: false,
          submittedAt: null,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    debugLog("CODING", "run_visible_done", {
      passed: `${evaluation.passedTests}/${evaluation.totalTests}`,
    });

    return op.respond({
      passedTests: evaluation.passedTests,
      totalTests: evaluation.totalTests,
      executionTimeMs: evaluation.executionTimeMs,
      results: evaluation.results.map((r) => ({
        index: r.index,
        passed: r.passed,
        status: r.status,
        timeMs: r.timeMs,
        message: r.message,
        stdout: r.stdout,
        // Visible expected output helps learning on Run only.
        expectedOutput: visible[r.index - 1]?.expectedOutput ?? "",
        input: visible[r.index - 1]?.input ?? "",
      })),
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function submitCodingAction(raw: unknown) {
  const op = createServerOp({
    domain: "SUBMISSION",
    operation: "CODING_SUBMIT",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    const data = codingPayloadSchema.parse(raw);
    await connectDB();

    const { attempt, question } = await loadCodingContext(
      session.user.id,
      data.attemptId,
      data.questionId,
    );
    op.allowed("student submit coding");

    if (!question.codingLanguages.includes(data.language)) {
      throw new ActionError("Unsupported language for this question.");
    }

    assertValidCodingSource(data.sourceCode);

    const existingFinal = await CodingSubmission.findOne({
      attemptId: attempt._id,
      questionId: question._id,
      kind: "submit",
      finalized: true,
    });
    if (existingFinal) {
      throw new ActionError("Coding answer already submitted for this question.");
    }

    const hidden = (question.testCases || []).filter((t) => t.isHidden);
    const suite = hidden.length
      ? hidden
      : (question.testCases || []).filter(Boolean);
    if (!suite.length) {
      throw new ActionError("No test cases configured for submission.");
    }

    debugLog("SUBMISSION", "started", {
      attemptId: maskId(data.attemptId),
      questionId: maskId(data.questionId),
      hiddenOnly: Boolean(hidden.length),
      tests: suite.length,
    });
    debugLog("CODE-RUNNER", "executing hidden/submit suite", {
      count: suite.length,
    });

    const evaluation = await evaluateAgainstTests({
      language: data.language,
      sourceCode: data.sourceCode,
      tests: suite.map((t) => ({
        input: t.input,
        expectedOutput: t.expectedOutput,
        isHidden: true,
        weight: t.weight ?? 1,
      })),
      timeLimitMs: question.timeLimitMs || 3000,
      memoryLimitMb: question.memoryLimitMb || 256,
      revealOutputs: false,
      maxScore: question.points,
    });

    await Answer.findOneAndUpdate(
      {
        attemptId: attempt._id,
        questionId: question._id,
        studentId: session.user.id,
      },
      {
        $set: {
          textAnswer: data.sourceCode,
          selectedOptionKey: data.language,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    const submission = await CodingSubmission.findOneAndUpdate(
      {
        attemptId: attempt._id,
        questionId: question._id,
        kind: "submit",
      },
      {
        $set: {
          studentId: session.user.id,
          assessmentId: attempt.assessmentId,
          language: data.language,
          sourceCode: data.sourceCode,
          status: evaluation.status,
          passedTests: evaluation.passedTests,
          totalTests: evaluation.totalTests,
          score: evaluation.score,
          maxScore: evaluation.maxScore,
          executionTimeMs: evaluation.executionTimeMs,
          visibleResults: [],
          finalized: true,
          submittedAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    );

    // If result already exists (edge), refresh coding score on it.
    const result = await Result.findOne({ attemptId: attempt._id });
    if (result) {
      const idx = result.questions.findIndex(
        (q) => q.questionId.toString() === question._id.toString(),
      );
      if (idx >= 0) {
        result.questions[idx].awardedPoints = evaluation.score;
        result.questions[idx].evalStatus =
          evaluation.score === question.points
            ? "correct"
            : evaluation.score === 0
              ? "incorrect"
              : "auto_graded";
        result.questions[idx].textAnswer = data.sourceCode;
        result.questions[idx].selectedOptionKey = data.language;
        result.questions[idx].passedTests = evaluation.passedTests;
        result.questions[idx].totalTests = evaluation.totalTests;
        result.questions[idx].feedback = `${evaluation.passedTests}/${evaluation.totalTests} tests passed`;
        result.questions[idx].gradedAt = new Date();
        result.markModified("questions");
        Object.assign(result, recalculateResultScores(result.questions));
        await result.save();
      }
    }

    debugLog("SUBMISSION", "completed", {
      score: evaluation.score,
      passed: `${evaluation.passedTests}/${evaluation.totalTests}`,
    });

    revalidatePath(`/student/exam/session/${attempt._id.toString()}`);

    return op.respond({
      submissionId: submission!._id.toString(),
      passedTests: evaluation.passedTests,
      totalTests: evaluation.totalTests,
      score: evaluation.score,
      maxScore: evaluation.maxScore,
      status: evaluation.status,
      // Never include hidden inputs/expected outputs.
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function getCodingSubmissionSummaryAction(
  attemptId: string,
  questionId: string,
) {
  const op = createServerOp({
    domain: "CODING",
    operation: "GET_SUMMARY",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    await connectDB();
    await getOwnedAttempt(attemptId, session.user.id);
    op.allowed("owner coding summary");

    const submission = await CodingSubmission.findOne({
      attemptId,
      questionId,
      kind: "submit",
      finalized: true,
      studentId: session.user.id,
    });

    if (!submission) return op.respond({ submission: null });
    return op.respond({
      submission: {
        language: submission.language,
        passedTests: submission.passedTests,
        totalTests: submission.totalTests,
        score: submission.score,
        maxScore: submission.maxScore,
        status: submission.status,
        submittedAt: submission.submittedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    return op.respondError(error);
  }
}
