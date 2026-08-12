import mongoose from "mongoose";
import { ActionError } from "@/lib/auth-guards";
import { evaluateAgainstTests } from "@/lib/coding/evaluate";
import { debugLog, logAuthorization, maskId } from "@/lib/debug";
import { recalculateResultScores } from "@/lib/exam/score";
import { Answer } from "@/models/Answer";
import type { AttemptDocument } from "@/models/Attempt";
import { Attempt } from "@/models/Attempt";
import { CodingSubmission } from "@/models/CodingSubmission";
import { Question } from "@/models/Question";
import { Result } from "@/models/Result";
import type { AnswerEvalStatus } from "@/types/exam";
import type { CodingLanguage } from "@/types/assessment";
import { CODING_LANGUAGES } from "@/types/assessment";

export async function ensureAttemptNotExpired(
  attempt: AttemptDocument,
): Promise<AttemptDocument> {
  if (attempt.status !== "in_progress") return attempt;

  const now = new Date();
  if (now.getTime() <= new Date(attempt.expiresAt).getTime()) {
    return attempt;
  }

  debugLog("EXAM", "TIMER_CHECK", {
    attemptId: attempt._id.toString().slice(0, 8),
    expired: true,
  });

  return finalizeAttempt(attempt, "expired");
}

function isCodingLanguage(value: string): value is CodingLanguage {
  return (CODING_LANGUAGES as readonly string[]).includes(value);
}

async function resolveCodingScore(options: {
  attemptId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  assessmentId: mongoose.Types.ObjectId;
  question: {
    _id: mongoose.Types.ObjectId;
    points: number;
    timeLimitMs?: number | null;
    memoryLimitMb?: number | null;
    testCases?: Array<{
      input: string;
      expectedOutput: string;
      isHidden?: boolean | null;
      weight?: number | null;
    }>;
    codingLanguages?: string[] | null;
  };
  textAnswer: string;
  languageHint: string;
}) {
  const existing = await CodingSubmission.findOne({
    attemptId: options.attemptId,
    questionId: options.question._id,
    kind: "submit",
    finalized: true,
  });
  if (existing) {
    return {
      score: existing.score,
      passedTests: existing.passedTests,
      totalTests: existing.totalTests,
      language: existing.language,
      sourceCode: existing.sourceCode,
    };
  }

  if (!options.textAnswer.trim()) {
    return {
      score: 0,
      passedTests: 0,
      totalTests: (options.question.testCases || []).length,
      language: options.languageHint || "python",
      sourceCode: "",
    };
  }

  const language = isCodingLanguage(options.languageHint)
    ? options.languageHint
    : ((options.question.codingLanguages?.[0] as CodingLanguage) || "python");

  const hidden = (options.question.testCases || []).filter((t) => t.isHidden);
  const suite = hidden.length ? hidden : options.question.testCases || [];
  if (!suite.length) {
    return {
      score: 0,
      passedTests: 0,
      totalTests: 0,
      language,
      sourceCode: options.textAnswer,
    };
  }

  const evaluation = await evaluateAgainstTests({
    language,
    sourceCode: options.textAnswer,
    tests: suite.map((t) => ({
      input: t.input,
      expectedOutput: t.expectedOutput,
      isHidden: true,
      weight: t.weight ?? 1,
    })),
    timeLimitMs: options.question.timeLimitMs || 3000,
    memoryLimitMb: options.question.memoryLimitMb || 256,
    revealOutputs: false,
    maxScore: options.question.points,
  });

  await CodingSubmission.findOneAndUpdate(
    {
      attemptId: options.attemptId,
      questionId: options.question._id,
      kind: "submit",
    },
    {
      $set: {
        studentId: options.studentId,
        assessmentId: options.assessmentId,
        language,
        sourceCode: options.textAnswer,
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

  return {
    score: evaluation.score,
    passedTests: evaluation.passedTests,
    totalTests: evaluation.totalTests,
    language,
    sourceCode: options.textAnswer,
  };
}

export async function finalizeAttempt(
  attempt: AttemptDocument,
  reason: "submitted" | "expired",
): Promise<AttemptDocument> {
  if (attempt.status !== "in_progress") {
    return attempt;
  }

  const answers = await Answer.find({ attemptId: attempt._id });
  const answerByQuestion = new Map(
    answers.map((a) => [a.questionId.toString(), a]),
  );

  const questions = await Question.find({
    _id: { $in: attempt.questionIds },
  });
  const questionById = new Map(questions.map((q) => [q._id.toString(), q]));

  const resultQuestions = [];
  for (const qid of attempt.questionIds ?? []) {
    const id = qid.toString();
    const question = questionById.get(id);
    const answer = answerByQuestion.get(id);
    const points = question?.points ?? 0;
    const type = question?.type ?? "mcq";
    const selectedOptionKey = answer?.selectedOptionKey ?? "";
    const textAnswer = answer?.textAnswer ?? "";

    if (type === "mcq") {
      const correctKey = question?.correctOptionKey ?? "";
      const isCorrect =
        Boolean(selectedOptionKey) &&
        Boolean(correctKey) &&
        selectedOptionKey === correctKey;
      const awardedPoints = isCorrect ? points : 0;
      const evalStatus: AnswerEvalStatus = !selectedOptionKey
        ? "incorrect"
        : isCorrect
          ? "correct"
          : "incorrect";

      resultQuestions.push({
        questionId: qid,
        type,
        points,
        awardedPoints,
        evalStatus,
        selectedOptionKey,
        correctOptionKey: correctKey,
        textAnswer: "",
        prompt: question?.prompt ?? "",
        feedback: "",
        gradedBy: null,
        gradedAt: null,
        passedTests: 0,
        totalTests: 0,
      });
      continue;
    }

    if (type === "coding" && question) {
      const coding = await resolveCodingScore({
        attemptId: attempt._id,
        studentId: attempt.studentId,
        assessmentId: attempt.assessmentId,
        question,
        textAnswer,
        languageHint: selectedOptionKey,
      });
      const evalStatus: AnswerEvalStatus =
        coding.score === points
          ? "correct"
          : coding.score === 0
            ? "incorrect"
            : "auto_graded";

      resultQuestions.push({
        questionId: qid,
        type,
        points,
        awardedPoints: coding.score,
        evalStatus,
        selectedOptionKey: coding.language,
        correctOptionKey: "",
        textAnswer: coding.sourceCode,
        prompt: question.prompt ?? "",
        feedback:
          coding.totalTests > 0
            ? `${coding.passedTests}/${coding.totalTests} tests passed`
            : "",
        gradedBy: null,
        gradedAt: new Date(),
        passedTests: coding.passedTests,
        totalTests: coding.totalTests,
      });
      continue;
    }

    resultQuestions.push({
      questionId: qid,
      type,
      points,
      awardedPoints: 0,
      evalStatus: "pending_evaluation" as AnswerEvalStatus,
      selectedOptionKey,
      correctOptionKey: "",
      textAnswer,
      prompt: question?.prompt ?? "",
      feedback: "",
      gradedBy: null,
      gradedAt: null,
      passedTests: 0,
      totalTests: 0,
    });
  }

  const scores = recalculateResultScores(resultQuestions);
  const submittedAt = new Date();

  const result = await Result.findOneAndUpdate(
    { attemptId: attempt._id },
    {
      $setOnInsert: {
        attemptId: attempt._id,
        studentId: attempt.studentId,
        assessmentId: attempt.assessmentId,
      },
      $set: {
        assessmentTitle: attempt.assessmentTitle,
        ...scores,
        questions: resultQuestions,
        submittedAt,
        finalizedReason: reason,
        evaluationCompletedAt:
          scores.evaluationStatus === "completed" ? submittedAt : null,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  const updated = await Attempt.findOneAndUpdate(
    { _id: attempt._id, status: "in_progress" },
    {
      $set: {
        status: reason === "expired" ? "expired" : "submitted",
        submittedAt,
        resultId: result._id,
      },
    },
    { returnDocument: "after" },
  );

  debugLog("RESULT", "CREATED", {
    attemptId: attempt._id.toString().slice(0, 8),
    reason,
    objectiveScore: scores.objectiveScore,
    codingScore: scores.codingScore,
    evaluationStatus: scores.evaluationStatus.toUpperCase(),
  });

  return updated ?? (await Attempt.findById(attempt._id))!;
}

export async function getOwnedAttempt(
  attemptId: string,
  studentId: string,
): Promise<AttemptDocument> {
  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    throw new ActionError("Attempt not found.");
  }

  const attempt = await Attempt.findById(attemptId);
  if (!attempt) {
    throw new ActionError("Attempt not found.");
  }

  if (attempt.studentId.toString() !== studentId) {
    logAuthorization({
      allowed: false,
      action: "access_attempt",
      resource: `attempt:${maskId(attemptId)}`,
      role: "STUDENT",
      reason: "NOT_OWNER",
    });
    throw new ActionError("You cannot access this attempt.");
  }

  logAuthorization({
    allowed: true,
    action: "access_attempt",
    resource: `attempt:${maskId(attemptId)}`,
    role: "STUDENT",
  });

  return attempt;
}
