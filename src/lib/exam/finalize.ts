import mongoose from "mongoose";
import { ActionError } from "@/lib/auth-guards";
import { debugLog } from "@/lib/debug";
import { Answer } from "@/models/Answer";
import type { AttemptDocument } from "@/models/Attempt";
import { Attempt } from "@/models/Attempt";
import { Question } from "@/models/Question";
import { Result } from "@/models/Result";
import type { AnswerEvalStatus } from "@/types/exam";

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

  let objectiveScore = 0;
  let objectiveMaxMarks = 0;
  let subjectivePendingCount = 0;
  let subjectiveMaxMarks = 0;

  const resultQuestions = (attempt.questionIds ?? []).map((qid) => {
    const id = qid.toString();
    const question = questionById.get(id);
    const answer = answerByQuestion.get(id);
    const points = question?.points ?? 0;
    const type = question?.type ?? "mcq";
    const selectedOptionKey = answer?.selectedOptionKey ?? "";
    const textAnswer = answer?.textAnswer ?? "";

    if (type === "mcq") {
      objectiveMaxMarks += points;
      const correctKey = question?.correctOptionKey ?? "";
      const isCorrect =
        Boolean(selectedOptionKey) &&
        Boolean(correctKey) &&
        selectedOptionKey === correctKey;
      const awardedPoints = isCorrect ? points : 0;
      objectiveScore += awardedPoints;
      const evalStatus: AnswerEvalStatus = !selectedOptionKey
        ? "incorrect"
        : isCorrect
          ? "correct"
          : "incorrect";

      return {
        questionId: qid,
        type,
        points,
        awardedPoints,
        evalStatus,
        selectedOptionKey,
        correctOptionKey: correctKey,
        textAnswer: "",
        prompt: question?.prompt ?? "",
      };
    }

    // Subjective + coding: pending evaluation (no AI / runner yet).
    subjectiveMaxMarks += points;
    subjectivePendingCount += 1;

    return {
      questionId: qid,
      type,
      points,
      awardedPoints: 0,
      evalStatus: "pending_evaluation" as AnswerEvalStatus,
      selectedOptionKey,
      correctOptionKey: "",
      textAnswer,
      prompt: question?.prompt ?? "",
    };
  });

  const submittedAt = new Date();
  const totalMarks = objectiveMaxMarks + subjectiveMaxMarks;

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
        objectiveScore,
        objectiveMaxMarks,
        subjectivePendingCount,
        subjectiveMaxMarks,
        totalMarks,
        questions: resultQuestions,
        submittedAt,
        finalizedReason: reason,
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
    objectiveScore,
    objectiveMaxMarks,
    subjectivePendingCount,
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
    debugLog("AUTHORIZATION", "DENIED", { reason: "attempt_ownership" });
    debugLog("HTTP", "403 Forbidden");
    throw new ActionError("You cannot access this attempt.");
  }

  debugLog("AUTHORIZATION", "ALLOWED", { reason: "attempt_owner" });

  return attempt;
}
