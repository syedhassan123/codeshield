"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { ActionError, requireAdmin, requireStudent } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp, debugLog, maskId } from "@/lib/debug";
import { recalculateResultScores } from "@/lib/exam/score";
import {
  serializeAttempt,
  serializeResult,
} from "@/lib/serializers";
import {
  adminAttemptFilterSchema,
  gradeQuestionSchema,
} from "@/lib/validators/grading";
import { Assessment } from "@/models/Assessment";
import { Attempt } from "@/models/Attempt";
import { Result } from "@/models/Result";
import { User } from "@/models/User";

function toError(error: unknown) {
  if (error instanceof ActionError) return { error: error.message };
  if (error instanceof ZodError) {
    return { error: error.issues[0]?.message || "Invalid input." };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong." };
}

function timeTakenLabel(startedAt?: Date | null, submittedAt?: Date | null) {
  if (!startedAt || !submittedAt) return null;
  const ms = Math.max(0, submittedAt.getTime() - startedAt.getTime());
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

export async function listAdminAttemptsAction(rawFilters?: unknown) {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "LIST",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin list attempts");
    await connectDB();

    const filters = adminAttemptFilterSchema.parse(rawFilters ?? {});
    const query: Record<string, unknown> = {};

    if (filters.assessmentId !== "all") {
      if (!mongoose.Types.ObjectId.isValid(filters.assessmentId)) {
        throw new ActionError("Invalid assessment filter.");
      }
      query.assessmentId = filters.assessmentId;
    }
    if (filters.studentId !== "all") {
      if (!mongoose.Types.ObjectId.isValid(filters.studentId)) {
        throw new ActionError("Invalid student filter.");
      }
      query.studentId = filters.studentId;
    }
    if (filters.status !== "all") {
      query.status = filters.status;
    }

    if (filters.evaluationStatus === "none") {
      query.status = "in_progress";
    } else if (
      filters.evaluationStatus === "pending" ||
      filters.evaluationStatus === "completed"
    ) {
      const evalFilter =
        filters.evaluationStatus === "pending"
          ? "pending"
          : ("completed" as const);
      const matched = await op.runMongo("filter results by evaluation", () =>
        Result.find({ evaluationStatus: evalFilter }).select("attemptId"),
      );
      query._id = { $in: matched.map((r) => r.attemptId) };
      if (filters.status === "all") {
        query.status = { $in: ["submitted", "expired"] };
      }
    }

    const skip = (filters.page - 1) * filters.pageSize;

    const [total, attempts] = await Promise.all([
      op.runMongo("count attempts", () => Attempt.countDocuments(query)),
      op.runMongo("list attempts", () =>
        Attempt.find(query)
          .sort({ submittedAt: -1, startedAt: -1 })
          .skip(skip)
          .limit(filters.pageSize),
      ),
    ]);

    const studentIds = [...new Set(attempts.map((a) => a.studentId.toString()))];
    const assessmentIds = [
      ...new Set(attempts.map((a) => a.assessmentId.toString())),
    ];
    const attemptIds = attempts.map((a) => a._id);

    const [students, assessments, results] = await Promise.all([
      User.find({ _id: { $in: studentIds } }).select("name email"),
      Assessment.find({ _id: { $in: assessmentIds } }).select("title type"),
      Result.find({ attemptId: { $in: attemptIds } }),
    ]);

    const studentMap = new Map(
      students.map((s) => [s._id.toString(), s]),
    );
    const assessmentMap = new Map(
      assessments.map((a) => [a._id.toString(), a]),
    );
    const resultMap = new Map(
      results.map((r) => [r.attemptId.toString(), r]),
    );

    const search = filters.search.trim().toLowerCase();
    let rows = attempts.map((attempt) => {
      const student = studentMap.get(attempt.studentId.toString());
      const assessment = assessmentMap.get(attempt.assessmentId.toString());
      const result = resultMap.get(attempt._id.toString());
      const evaluationStatus =
        attempt.status === "in_progress"
          ? "none"
          : (result?.evaluationStatus ?? "pending");

      return {
        id: attempt._id.toString(),
        studentName: student?.name ?? "Unknown",
        studentEmail: student?.email ?? "",
        assessmentId: attempt.assessmentId.toString(),
        assessmentTitle: attempt.assessmentTitle,
        assessmentType: assessment?.type ?? "mixed",
        status: attempt.status,
        evaluationStatus,
        objectiveScore: result?.objectiveScore ?? null,
        objectiveMaxMarks: result?.objectiveMaxMarks ?? null,
        finalScore: result?.finalScore ?? null,
        totalMarks: result?.totalMarks ?? attempt.totalMarks,
        startedAt: attempt.startedAt.toISOString(),
        submittedAt: attempt.submittedAt
          ? attempt.submittedAt.toISOString()
          : null,
      };
    });

    if (search) {
      rows = rows.filter(
        (r) =>
          r.studentName.toLowerCase().includes(search) ||
          r.studentEmail.toLowerCase().includes(search) ||
          r.assessmentTitle.toLowerCase().includes(search),
      );
    }

    debugLog("ATTEMPT", "LIST", {
      total,
      page: filters.page,
      returned: rows.length,
    });

    op.success({ count: rows.length, total });
    return {
      attempts: rows,
      total,
      page: filters.page,
      pageSize: filters.pageSize,
      pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
    };
  } catch (error) {
    op.fail(error);
    return toError(error);
  }
}

export async function listAdminAttemptFilterOptionsAction() {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "FILTER_OPTIONS",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin filter options");
    await connectDB();

    const [assessments, students] = await Promise.all([
      Assessment.find().select("title").sort({ title: 1 }),
      User.find({ role: "student" }).select("name email").sort({ name: 1 }),
    ]);

    op.success({
      assessments: assessments.length,
      students: students.length,
    });
    return {
      assessments: assessments.map((a) => ({
        id: a._id.toString(),
        title: a.title,
      })),
      students: students.map((s) => ({
        id: s._id.toString(),
        name: s.name,
        email: s.email,
      })),
    };
  } catch (error) {
    op.fail(error);
    return toError(error);
  }
}

export async function getAdminAttemptDetailAction(attemptId: string) {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "DETAIL",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin view attempt");
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      throw new ActionError("Attempt not found.");
    }

    const attempt = await op.runMongo("load attempt", () =>
      Attempt.findById(attemptId),
    );
    if (!attempt) throw new ActionError("Attempt not found.");

    const [student, assessment, result] = await Promise.all([
      User.findById(attempt.studentId).select("name email"),
      Assessment.findById(attempt.assessmentId).select(
        "title type durationMin totalMarks",
      ),
      Result.findOne({ attemptId: attempt._id }),
    ]);

    if (!student) throw new ActionError("Student not found.");

    debugLog("ATTEMPT", "DETAIL", {
      attemptId: maskId(attemptId),
      status: attempt.status,
      hasResult: Boolean(result),
    });

    op.success({ attemptId: maskId(attemptId) });
    return {
      attempt: serializeAttempt(attempt),
      student: {
        id: student._id.toString(),
        name: student.name,
        email: student.email,
      },
      assessment: {
        id: attempt.assessmentId.toString(),
        title: assessment?.title ?? attempt.assessmentTitle,
        type: assessment?.type ?? "mixed",
        durationMin: assessment?.durationMin ?? attempt.durationMin,
        totalMarks: assessment?.totalMarks ?? attempt.totalMarks,
      },
      result: result ? serializeResult(result) : null,
      timeTaken: timeTakenLabel(
        attempt.startedAt,
        attempt.submittedAt ?? null,
      ),
    };
  } catch (error) {
    op.fail(error, { resourceId: attemptId });
    return toError(error);
  }
}

export async function gradeQuestionAction(raw: unknown) {
  const op = createServerOp({
    domain: "GRADING",
    operation: "GRADE_QUESTION",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = gradeQuestionSchema.parse(raw);
    op.allowed("admin grade question");
    await connectDB();

    debugLog("GRADING", "start", {
      attemptId: maskId(data.attemptId),
      questionId: maskId(data.questionId),
    });

    if (!mongoose.Types.ObjectId.isValid(data.attemptId)) {
      throw new ActionError("Attempt not found.");
    }

    const attempt = await op.runMongo("load attempt for grading", () =>
      Attempt.findById(data.attemptId),
    );
    if (!attempt) throw new ActionError("Attempt not found.");
    if (attempt.status === "in_progress") {
      throw new ActionError("Cannot grade an in-progress attempt.");
    }

    const result = await op.runMongo("load result for grading", () =>
      Result.findOne({ attemptId: attempt._id }),
    );
    if (!result) throw new ActionError("Result not found for this attempt.");

    const idx = (result.questions ?? []).findIndex(
      (q) => q.questionId.toString() === data.questionId,
    );
    if (idx < 0) throw new ActionError("Question not found in this result.");

    const question = result.questions[idx];
    if (question.type === "mcq") {
      throw new ActionError("MCQ answers are auto-graded and cannot be edited.");
    }

    if (data.marks > question.points) {
      throw new ActionError(
        `Marks cannot exceed the maximum (${question.points}).`,
      );
    }

    const now = new Date();
    question.awardedPoints = data.marks;
    question.feedback = data.feedback.trim();
    question.evalStatus = "manually_graded";
    question.gradedBy = new mongoose.Types.ObjectId(session.user.id);
    question.gradedAt = now;
    result.markModified("questions");

    const scores = recalculateResultScores(result.questions);
    Object.assign(result, scores);
    result.lastGradedBy = new mongoose.Types.ObjectId(session.user.id);
    result.lastGradedAt = now;
    result.evaluationCompletedAt =
      scores.evaluationStatus === "completed"
        ? result.evaluationCompletedAt ?? now
        : null;

    await op.runMongo("save graded result", () =>
      result.save({ validateModifiedOnly: true }),
    );

    debugLog("GRADING", "saved", {
      attemptId: maskId(data.attemptId),
      questionId: maskId(data.questionId),
      marks: data.marks,
      evaluationStatus: scores.evaluationStatus.toUpperCase(),
    });

    revalidatePath("/admin/results");
    revalidatePath(`/admin/results/${data.attemptId}`);
    revalidatePath("/student/results");
    revalidatePath(`/student/exam/result/${data.attemptId}`);

    op.success({
      finalScore: scores.finalScore,
      evaluationStatus: scores.evaluationStatus,
    });
    return {
      result: serializeResult(result),
      attempt: serializeAttempt(attempt),
    };
  } catch (error) {
    op.fail(error);
    return toError(error);
  }
}

export async function completeEvaluationAction(attemptId: string) {
  const op = createServerOp({
    domain: "GRADING",
    operation: "COMPLETE_EVALUATION",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin complete evaluation");
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      throw new ActionError("Attempt not found.");
    }

    const attempt = await Attempt.findById(attemptId);
    if (!attempt) throw new ActionError("Attempt not found.");
    if (attempt.status === "in_progress") {
      throw new ActionError("Attempt is still in progress.");
    }

    const result = await Result.findOne({ attemptId: attempt._id });
    if (!result) throw new ActionError("Result not found.");

    const scores = recalculateResultScores(result.questions);
    if (scores.evaluationStatus !== "completed") {
      throw new ActionError(
        "All subjective/coding questions must be graded first.",
      );
    }

    Object.assign(result, scores);
    result.lastGradedBy = new mongoose.Types.ObjectId(session.user.id);
    result.lastGradedAt = new Date();
    result.evaluationCompletedAt = result.evaluationCompletedAt ?? new Date();
    await result.save();

    debugLog("GRADING", "evaluation_completed", {
      attemptId: maskId(attemptId),
      finalScore: scores.finalScore,
    });

    revalidatePath("/admin/results");
    revalidatePath(`/admin/results/${attemptId}`);
    revalidatePath("/student/results");
    revalidatePath(`/student/exam/result/${attemptId}`);

    op.success({ finalScore: scores.finalScore });
    return { result: serializeResult(result) };
  } catch (error) {
    op.fail(error, { resourceId: attemptId });
    return toError(error);
  }
}

/** Student: ensure they only read own result (IDOR safe). */
export async function getStudentResultDetailAction(attemptId: string) {
  const op = createServerOp({
    domain: "RESULT",
    operation: "STUDENT_GET",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      throw new ActionError("Result not found.");
    }

    const attempt = await Attempt.findById(attemptId);
    if (!attempt || attempt.studentId.toString() !== session.user.id) {
      debugLog("AUTHORIZATION", "DENIED", { reason: "result_ownership" });
      debugLog("HTTP", "403 Forbidden");
      throw new ActionError("You cannot access this result.");
    }
    op.allowed("student own result");

    const result = await Result.findOne({
      attemptId: attempt._id,
      studentId: session.user.id,
    });
    if (!result) throw new ActionError("Result not found.");

    op.success({ attemptId: maskId(attemptId) });
    return {
      attempt: serializeAttempt(attempt),
      result: serializeResult(result),
    };
  } catch (error) {
    op.fail(error, { resourceId: attemptId });
    return toError(error);
  }
}
