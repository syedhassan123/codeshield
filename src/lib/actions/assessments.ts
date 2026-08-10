"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import { ZodError } from "zod";
import { connectDB } from "@/lib/db";
import { ActionError, requireAdmin, requireRole } from "@/lib/auth-guards";
import { createServerOp } from "@/lib/debug";
import {
  serializeAssessment,
  serializeQuestion,
} from "@/lib/serializers";
import {
  assessmentInputSchema,
  assessmentQuestionsSchema,
  assessmentStatusSchema,
} from "@/lib/validators/assessment";
import { nextSequence } from "@/models/Counter";
import { Assessment } from "@/models/Assessment";
import { Question } from "@/models/Question";

function toError(error: unknown) {
  if (error instanceof ActionError) return { error: error.message };
  if (error instanceof ZodError) {
    return { error: error.issues[0]?.message || "Invalid input." };
  }
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong." };
}

async function computeMarks(questionIds: mongoose.Types.ObjectId[]) {
  if (!questionIds.length) return 0;
  const qs = await Question.find({ _id: { $in: questionIds } }).select("points");
  return qs.reduce((sum, q) => sum + q.points, 0);
}

async function assertQuestionsExist(ids: string[]) {
  if (!ids.length) return [] as mongoose.Types.ObjectId[];
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const count = await Question.countDocuments({ _id: { $in: objectIds } });
  if (count !== ids.length) {
    throw new ActionError("One or more questions do not exist.");
  }
  return objectIds;
}

export async function listAssessmentsAction(typeFilter?: string) {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "GET_LIST",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    await connectDB();

    const query: Record<string, unknown> = {};
    if (typeFilter && typeFilter !== "all") {
      query.type = typeFilter.toLowerCase();
    }

    const docs = await op.runMongo("fetching assessments", () =>
      Assessment.find(query).sort({ updatedAt: -1 }),
    );

    op.success({ count: docs.length });
    return {
      assessments: docs.map((doc) =>
        serializeAssessment(doc, {
          questionCount: doc.questionIds?.length ?? 0,
        }),
      ),
    };
  } catch (error) {
    op.fail(error);
    throw error;
  }
}

export async function getAssessmentAction(id: string) {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "GET_ONE",
    source: "SERVER-ACTION",
    resourceId: id,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    await connectDB();

    const doc = await op.runMongo("fetching assessment by id", () =>
      Assessment.findById(id),
    );
    if (!doc) throw new ActionError("Assessment not found.");

    const questions = await op.runMongo("fetching assessment questions", () =>
      Question.find({ _id: { $in: doc.questionIds } }),
    );
    const ordered = (doc.questionIds ?? [])
      .map((qid) => questions.find((q) => q._id.equals(qid)))
      .filter(Boolean)
      .map((q) => serializeQuestion(q!));

    const marks = ordered.reduce((sum, q) => sum + q.points, 0);

    op.success({ code: doc.code, questions: ordered.length });
    return {
      assessment: serializeAssessment(doc, {
        questionCount: ordered.length,
        computedMarks: marks,
      }),
      questions: ordered,
    };
  } catch (error) {
    op.fail(error, { resourceId: id });
    throw error;
  }
}

export async function createAssessmentAction(raw: unknown) {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "CREATE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = assessmentInputSchema.parse(raw);
    await connectDB();

    const questionIds = await op.runMongo("validating question refs", () =>
      assertQuestionsExist(data.questionIds),
    );
    const totalMarks =
      data.totalMarks != null && data.totalMarks > 0
        ? data.totalMarks
        : await computeMarks(questionIds);

    const seq = await op.runMongo("next assessment sequence", () =>
      nextSequence("assessment", 201),
    );
    const code = `ASM-${seq}`;

    const doc = await op.runMongo("creating assessment", () =>
      Assessment.create({
        code,
        title: data.title,
        description: data.description,
        instructions: data.instructions,
        type: data.type,
        category: data.category,
        difficulty: data.difficulty,
        durationMin: data.durationMin,
        totalMarks,
        questionIds,
        visibility: data.visibility,
        assignedStudentIds: data.assignedStudentIds,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: data.scheduledAt ? "scheduled" : "draft",
        createdBy: session.user.id,
      }),
    );

    revalidatePath("/admin/assessments");
    revalidatePath("/student/assessments");
    op.success({ code: doc.code, status: doc.status });
    return { assessment: serializeAssessment(doc) };
  } catch (error) {
    op.fail(error);
    return toError(error);
  }
}

export async function updateAssessmentAction(id: string, raw: unknown) {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "UPDATE",
    source: "SERVER-ACTION",
    resourceId: id,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = assessmentInputSchema.parse(raw);
    await connectDB();

    const doc = await op.runMongo("fetching assessment for update", () =>
      Assessment.findById(id),
    );
    if (!doc) throw new ActionError("Assessment not found.");

    const questionIds = await op.runMongo("validating question refs", () =>
      assertQuestionsExist(data.questionIds),
    );
    const totalMarks =
      data.totalMarks != null && data.totalMarks > 0
        ? data.totalMarks
        : await computeMarks(questionIds);

    doc.title = data.title;
    doc.description = data.description;
    doc.instructions = data.instructions;
    doc.type = data.type;
    doc.category = data.category;
    doc.difficulty = data.difficulty;
    doc.durationMin = data.durationMin;
    doc.totalMarks = totalMarks;
    doc.questionIds = questionIds;
    doc.visibility = data.visibility;
    doc.assignedStudentIds = data.assignedStudentIds.map(
      (sid) => new mongoose.Types.ObjectId(sid),
    );
    doc.scheduledAt = data.scheduledAt ? new Date(data.scheduledAt) : null;

    if (doc.status === "draft" && data.scheduledAt) {
      doc.status = "scheduled";
    }

    await op.runMongo("saving assessment", () => doc.save());

    revalidatePath("/admin/assessments");
    revalidatePath(`/admin/assessments/${id}`);
    revalidatePath("/student/assessments");
    revalidatePath("/student");
    op.success({ code: doc.code, status: doc.status });
    return { assessment: serializeAssessment(doc) };
  } catch (error) {
    op.fail(error, { resourceId: id });
    return toError(error);
  }
}

export async function setAssessmentQuestionsAction(id: string, raw: unknown) {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "SET_QUESTIONS",
    source: "SERVER-ACTION",
    resourceId: id,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = assessmentQuestionsSchema.parse(raw);
    await connectDB();

    const doc = await op.runMongo("fetching assessment", () =>
      Assessment.findById(id),
    );
    if (!doc) throw new ActionError("Assessment not found.");

    const questionIds = await op.runMongo("validating question refs", () =>
      assertQuestionsExist(data.questionIds),
    );
    doc.questionIds = questionIds;
    doc.totalMarks = await computeMarks(questionIds);
    await op.runMongo("saving assessment questions", () => doc.save());

    revalidatePath("/admin/assessments");
    revalidatePath(`/admin/assessments/${id}`);
    revalidatePath("/student/assessments");
    op.success({
      code: doc.code,
      questionCount: questionIds.length,
      totalMarks: doc.totalMarks,
    });
    return { assessment: serializeAssessment(doc) };
  } catch (error) {
    op.fail(error, { resourceId: id });
    return toError(error);
  }
}

export async function setAssessmentStatusAction(id: string, raw: unknown) {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "SET_STATUS",
    source: "SERVER-ACTION",
    resourceId: id,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const { status } = assessmentStatusSchema.parse(raw);
    await connectDB();

    const doc = await op.runMongo("fetching assessment for status", () =>
      Assessment.findById(id),
    );
    if (!doc) throw new ActionError("Assessment not found.");

    if (status === "published" && (!doc.questionIds || !doc.questionIds.length)) {
      throw new ActionError("Add at least one question before publishing.");
    }

    const previous = doc.status;
    doc.status = status;
    doc.publishedAt = status === "published" ? new Date() : doc.publishedAt;
    await op.runMongo(`updating status ${previous} -> ${status}`, () =>
      doc.save(),
    );

    revalidatePath("/admin/assessments");
    revalidatePath(`/admin/assessments/${id}`);
    revalidatePath("/student/assessments");
    revalidatePath("/student");
    op.success({
      code: doc.code,
      previous,
      status: doc.status,
      publish: status === "published" ? "publish" : "unpublish/other",
    });
    return { assessment: serializeAssessment(doc) };
  } catch (error) {
    op.fail(error, { resourceId: id });
    return toError(error);
  }
}

export async function deleteAssessmentAction(id: string) {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "DELETE",
    source: "SERVER-ACTION",
    resourceId: id,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    await connectDB();

    const doc = await op.runMongo("fetching assessment for delete", () =>
      Assessment.findById(id),
    );
    if (!doc) throw new ActionError("Assessment not found.");

    await op.runMongo("deleting assessment", () => doc.deleteOne());
    revalidatePath("/admin/assessments");
    revalidatePath("/student/assessments");
    revalidatePath("/student");
    op.success({ code: doc.code });
    return { success: true };
  } catch (error) {
    op.fail(error, { resourceId: id });
    return toError(error);
  }
}

/** Student catalog: published + available to this student */
export async function listStudentAssessmentsAction() {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "STUDENT_GET_LIST",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireRole(["student"]);
    op.auth(session.user);
    await connectDB();

    const studentId = new mongoose.Types.ObjectId(session.user.id);

    const docs = await op.runMongo("fetching published student assessments", () =>
      Assessment.find({
        status: "published",
        $or: [
          { visibility: "all" },
          { visibility: "assigned", assignedStudentIds: studentId },
        ],
      }).sort({ publishedAt: -1, updatedAt: -1 }),
    );

    op.success({ count: docs.length });
    return {
      assessments: docs.map((doc) =>
        serializeAssessment(doc, {
          questionCount: doc.questionIds?.length ?? 0,
        }),
      ),
    };
  } catch (error) {
    op.fail(error);
    throw error;
  }
}

export async function getStudentAssessmentAction(idOrCode: string) {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "STUDENT_GET_ONE",
    source: "SERVER-ACTION",
    resourceId: idOrCode,
  });

  try {
    const session = await requireRole(["student"]);
    op.auth(session.user);
    await connectDB();

    const studentId = new mongoose.Types.ObjectId(session.user.id);
    const identity = mongoose.Types.ObjectId.isValid(idOrCode)
      ? { $or: [{ _id: idOrCode }, { code: idOrCode }] }
      : { code: idOrCode };

    const doc = await op.runMongo("fetching published student assessment", () =>
      Assessment.findOne({
        $and: [
          identity,
          { status: "published" },
          {
            $or: [
              { visibility: "all" },
              { visibility: "assigned", assignedStudentIds: studentId },
            ],
          },
        ],
      }),
    );

    if (!doc) throw new ActionError("Assessment not available.");

    op.success({ code: doc.code });
    return {
      assessment: serializeAssessment(doc, {
        questionCount: doc.questionIds?.length ?? 0,
      }),
    };
  } catch (error) {
    op.fail(error, { resourceId: idOrCode });
    throw error;
  }
}
