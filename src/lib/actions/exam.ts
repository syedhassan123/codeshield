"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { ZodError, z } from "zod";
import { ActionError, requireStudent } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp, debugLog, maskId } from "@/lib/debug";
import { findPublishedAssessmentForStudent } from "@/lib/exam/access";
import {
  ensureAttemptNotExpired,
  finalizeAttempt,
  getOwnedAttempt,
} from "@/lib/exam/finalize";
import {
  serializeAnswer,
  serializeAttempt,
  serializeExamQuestion,
  serializeResult,
} from "@/lib/serializers";
import { Answer } from "@/models/Answer";
import { Assessment } from "@/models/Assessment";
import { Attempt } from "@/models/Attempt";
import { CodingSubmission } from "@/models/CodingSubmission";
import { Question } from "@/models/Question";
import { Result } from "@/models/Result";
import { normalizeAssessmentSecurity } from "@/types/assessment-security";

function toError(error: unknown) {
  if (error instanceof ActionError) return { error: error.message };
  if (error instanceof ZodError) {
    return { error: error.issues[0]?.message || "Invalid input." };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong." };
}

const saveAnswerSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  selectedOptionKey: z.string().optional().default(""),
  textAnswer: z.string().optional().default(""),
});

export async function startExamAction(assessmentIdOrCode: string) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "START",
    source: "SERVER-ACTION",
    resourceId: assessmentIdOrCode,
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    op.allowed("student start exam");
    await connectDB();

    const assessment = await op.runMongo("load published assessment", () =>
      findPublishedAssessmentForStudent(assessmentIdOrCode, session.user.id),
    );

    if (!assessment.questionIds?.length) {
      throw new ActionError("This assessment has no questions yet.");
    }

    const studentOid = new mongoose.Types.ObjectId(session.user.id);

    const existing = await op.runMongo("check active attempt", () =>
      Attempt.findOne({
        studentId: studentOid,
        assessmentId: assessment._id,
        status: "in_progress",
      }),
    );

    if (existing) {
      const live = await ensureAttemptNotExpired(existing);
      if (live.status === "in_progress") {
        debugLog("EXAM", "START", {
          mode: "resume",
          attemptId: maskId(live._id.toString()),
        });
        return op.respond({
          attempt: serializeAttempt(live),
          resumed: true as const,
        });
      }
    }

    const startedAt = new Date();
    const expiresAt = new Date(
      startedAt.getTime() + assessment.durationMin * 60 * 1000,
    );

    let attempt;
    try {
      attempt = await op.runMongo("create attempt", () =>
        Attempt.create({
          studentId: studentOid,
          assessmentId: assessment._id,
          status: "in_progress",
          startedAt,
          expiresAt,
          durationMin: assessment.durationMin,
          questionIds: assessment.questionIds,
          assessmentTitle: assessment.title,
          totalMarks: assessment.totalMarks,
        }),
      );
    } catch (error) {
      // Race: another request created the active attempt — resume it.
      const raced = await Attempt.findOne({
        studentId: studentOid,
        assessmentId: assessment._id,
        status: "in_progress",
      });
      if (!raced) throw error;
      debugLog("EXAM", "START", {
        mode: "resume_race",
        attemptId: maskId(raced._id.toString()),
      });
      return op.respond({
        attempt: serializeAttempt(raced),
        resumed: true as const,
      });
    }

    debugLog("EXAM", "START", {
      mode: "create",
      attemptId: maskId(attempt._id.toString()),
      assessmentId: maskId(assessment._id.toString()),
    });

    revalidatePath("/student/assessments");
    revalidatePath("/student/results");
    return op.respond({
      attempt: serializeAttempt(attempt),
      resumed: false as const,
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function loadExamSessionAction(attemptId: string) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "LOAD",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    await connectDB();

    let attempt = await op.runMongo("load attempt", () =>
      getOwnedAttempt(attemptId, session.user.id),
    );
    op.allowed("owner load exam session");

    debugLog("EXAM", "TIMER_CHECK", {
      attemptId: maskId(attemptId),
      status: attempt.status,
      expiresAt: attempt.expiresAt.toISOString(),
    });

    attempt = await ensureAttemptNotExpired(attempt);

    if (attempt.status !== "in_progress") {
      return op.respond({
        closed: true as const,
        attempt: serializeAttempt(attempt),
        resultId: attempt.resultId?.toString() ?? null,
      });
    }

    const questions = await op.runMongo("load exam questions", () =>
      Question.find({ _id: { $in: attempt.questionIds } }),
    );
    const byId = new Map(questions.map((q) => [q._id.toString(), q]));
    const ordered = (attempt.questionIds ?? [])
      .map((id) => byId.get(id.toString()))
      .filter(Boolean)
      .map((q) => serializeExamQuestion(q!));

    const answers = await op.runMongo("load answers", () =>
      Answer.find({ attemptId: attempt._id, studentId: session.user.id }),
    );

    const assessment = await op.runMongo("load assessment security", () =>
      Assessment.findById(attempt.assessmentId).select("security"),
    );

    const security = normalizeAssessmentSecurity(
      assessment?.security as
        | {
            requireCamera?: boolean;
            requireFullscreen?: boolean;
            blockCopyPaste?: boolean;
            monitorTabSwitching?: boolean;
            requireFaceDetection?: boolean;
            requireHeadMonitoring?: boolean;
          }
        | null
        | undefined,
    );

    debugLog("EXAM", "LOAD", {
      attemptId: maskId(attemptId),
      questionCount: ordered.length,
      answerCount: answers.length,
    });

    return op.respond({
      closed: false as const,
      attempt: serializeAttempt(attempt),
      questions: ordered,
      answers: answers.map(serializeAnswer),
      serverNow: new Date().toISOString(),
      security,
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function saveAnswerAction(raw: unknown) {
  const op = createServerOp({
    domain: "ANSWER",
    operation: "SAVE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    const data = saveAnswerSchema.parse(raw);
    await connectDB();

    let attempt = await op.runMongo("load attempt for save", () =>
      getOwnedAttempt(data.attemptId, session.user.id),
    );
    op.allowed("owner save answer");

    attempt = await ensureAttemptNotExpired(attempt);
    if (attempt.status !== "in_progress") {
      throw new ActionError("This attempt is closed. Answers cannot be changed.");
    }

    const allowed = (attempt.questionIds ?? []).some(
      (id) => id.toString() === data.questionId,
    );
    if (!allowed || !mongoose.Types.ObjectId.isValid(data.questionId)) {
      throw new ActionError("Question is not part of this attempt.");
    }

    const question = await op.runMongo("load question type", () =>
      Question.findById(data.questionId),
    );
    if (!question) throw new ActionError("Question not found.");

    let selectedOptionKey = data.selectedOptionKey?.trim() ?? "";
    let textAnswer = data.textAnswer ?? "";

    if (question.type === "mcq") {
      if (
        selectedOptionKey &&
        !(question.options ?? []).some((o) => o.key === selectedOptionKey)
      ) {
        throw new ActionError("Invalid option selected.");
      }
      textAnswer = "";
    } else if (question.type === "coding") {
      const finalized = await CodingSubmission.findOne({
        attemptId: attempt._id,
        questionId: question._id,
        kind: "submit",
        finalized: true,
      });
      if (finalized) {
        throw new ActionError(
          "Coding answer already submitted and cannot be changed.",
        );
      }
      if (
        selectedOptionKey &&
        !(question.codingLanguages ?? []).includes(
          selectedOptionKey as (typeof question.codingLanguages)[number],
        )
      ) {
        throw new ActionError("Unsupported language for this question.");
      }
      if (textAnswer.length > 100_000) {
        throw new ActionError("Source code is too long.");
      }
    } else {
      selectedOptionKey = "";
      if (textAnswer.length > 20000) {
        throw new ActionError("Answer is too long.");
      }
    }

    const answer = await op.runMongo("upsert answer", () =>
      Answer.findOneAndUpdate(
        {
          attemptId: attempt._id,
          questionId: data.questionId,
          studentId: session.user.id,
        },
        {
          $set: {
            selectedOptionKey,
            textAnswer,
            studentId: session.user.id,
            attemptId: attempt._id,
            questionId: data.questionId,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
      ),
    );

    debugLog("ANSWER", "SAVE", {
      attemptId: maskId(data.attemptId),
      questionId: maskId(data.questionId),
      type: question.type,
    });

    return op.respond({
      answer: serializeAnswer(answer!),
      attempt: serializeAttempt(attempt),
      serverNow: new Date().toISOString(),
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function submitExamAction(attemptId: string) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "SUBMIT",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    await connectDB();

    let attempt = await op.runMongo("load attempt for submit", () =>
      getOwnedAttempt(attemptId, session.user.id),
    );
    op.allowed("owner submit exam");

    debugLog("EXAM", "TIMER_CHECK", {
      attemptId: maskId(attemptId),
      expiresAt: attempt.expiresAt.toISOString(),
      now: new Date().toISOString(),
    });

    if (attempt.status === "in_progress") {
      const now = Date.now();
      const expired = now > new Date(attempt.expiresAt).getTime();
      attempt = await finalizeAttempt(
        attempt,
        expired ? "expired" : "submitted",
      );
    }

    const result = await op.runMongo("load result", () =>
      Result.findOne({ attemptId: attempt._id, studentId: session.user.id }),
    );
    if (!result) {
      throw new ActionError("Result could not be created.");
    }

    debugLog("EXAM", "SUBMIT", {
      attemptId: maskId(attemptId),
      status: attempt.status,
    });

    revalidatePath("/student/results");
    revalidatePath(`/student/exam/result/${attemptId}`);
    return op.respond({
      attempt: serializeAttempt(attempt),
      result: serializeResult(result),
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function getExamResultAction(attemptId: string) {
  const op = createServerOp({
    domain: "RESULT",
    operation: "GET",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    await connectDB();

    let attempt = await op.runMongo("load attempt for result", () =>
      getOwnedAttempt(attemptId, session.user.id),
    );
    op.allowed("owner view result");

    if (attempt.status === "in_progress") {
      attempt = await ensureAttemptNotExpired(attempt);
    }

    if (attempt.status === "in_progress") {
      throw new ActionError("Exam is still in progress.");
    }

    const result = await op.runMongo("load result document", () =>
      Result.findOne({ attemptId: attempt._id, studentId: session.user.id }),
    );
    if (!result) {
      throw new ActionError("Result not found.");
    }

    return op.respond({
      attempt: serializeAttempt(attempt),
      result: serializeResult(result),
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function listStudentResultsAction() {
  const op = createServerOp({
    domain: "RESULT",
    operation: "LIST",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    op.allowed("student list results");
    await connectDB();

    const results = await op.runMongo("list student results", () =>
      Result.find({ studentId: session.user.id }).sort({ submittedAt: -1 }),
    );

    return op.respond({ results: results.map(serializeResult) });
  } catch (error) {
    return op.respondError(error);
  }
}
