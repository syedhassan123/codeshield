"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { connectDB } from "@/lib/db";
import { ActionError, requireAdmin } from "@/lib/auth-guards";
import { createServerOp } from "@/lib/debug";
import { serializeQuestion } from "@/lib/serializers";
import {
  questionFilterSchema,
  questionInputSchema,
} from "@/lib/validators/question";
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

export async function listQuestionsAction(rawFilters?: unknown) {
  const op = createServerOp({
    domain: "QUESTION",
    operation: "GET_LIST",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    await connectDB();

    const filters = questionFilterSchema.parse(rawFilters ?? {});
    const query: Record<string, unknown> = {};

    if (filters.category !== "all") query.category = filters.category;
    if (filters.type !== "all") query.type = filters.type;
    if (filters.difficulty !== "all") query.difficulty = filters.difficulty;
    if (filters.search?.trim()) {
      query.$or = [
        { prompt: { $regex: filters.search.trim(), $options: "i" } },
        { code: { $regex: filters.search.trim(), $options: "i" } },
      ];
    }

    const docs = await op.runMongo("fetching questions", () =>
      Question.find(query).sort({ createdAt: -1 }).lean(false),
    );

    op.success({ count: docs.length });
    return { questions: docs.map(serializeQuestion) };
  } catch (error) {
    op.fail(error);
    throw error;
  }
}

export async function getQuestionAction(id: string) {
  const op = createServerOp({
    domain: "QUESTION",
    operation: "GET_ONE",
    source: "SERVER-ACTION",
    resourceId: id,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    await connectDB();

    const doc = await op.runMongo("fetching question by id", () =>
      Question.findById(id),
    );
    if (!doc) throw new ActionError("Question not found.");

    op.success({ code: doc.code });
    return { question: serializeQuestion(doc) };
  } catch (error) {
    op.fail(error, { resourceId: id });
    throw error;
  }
}

export async function createQuestionAction(raw: unknown) {
  const op = createServerOp({
    domain: "QUESTION",
    operation: "CREATE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = questionInputSchema.parse(raw);
    await connectDB();

    const seq = await op.runMongo("next question sequence", () =>
      nextSequence("question", 1001),
    );
    const code = `Q-${seq}`;

    const doc = await op.runMongo("creating question", () =>
      Question.create({
        ...data,
        code,
        createdBy: session.user.id,
        options: data.type === "mcq" ? data.options : [],
        correctOptionKey: data.type === "mcq" ? data.correctOptionKey : "",
        codingLanguages: data.type === "coding" ? data.codingLanguages : [],
        starterCode: data.type === "coding" ? data.starterCode : {},
        testCases: data.type === "coding" ? data.testCases : [],
        constraints: data.type === "coding" ? data.constraints : "",
        inputFormat: data.type === "coding" ? data.inputFormat : "",
        outputFormat: data.type === "coding" ? data.outputFormat : "",
        examples: data.type === "coding" ? data.examples : [],
        timeLimitMs: data.type === "coding" ? data.timeLimitMs : 3000,
        memoryLimitMb: data.type === "coding" ? data.memoryLimitMb : 256,
      }),
    );

    revalidatePath("/admin/questions");
    revalidatePath("/admin/assessments");
    op.success({ code: doc.code, type: doc.type });
    return { question: serializeQuestion(doc) };
  } catch (error) {
    op.fail(error);
    return toError(error);
  }
}

export async function updateQuestionAction(id: string, raw: unknown) {
  const op = createServerOp({
    domain: "QUESTION",
    operation: "UPDATE",
    source: "SERVER-ACTION",
    resourceId: id,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = questionInputSchema.parse(raw);
    await connectDB();

    const doc = await op.runMongo("updating question", () =>
      Question.findByIdAndUpdate(
        id,
        {
          prompt: data.prompt,
          type: data.type,
          category: data.category,
          difficulty: data.difficulty,
          points: data.points,
          explanation: data.explanation,
          options: data.type === "mcq" ? data.options : [],
          correctOptionKey: data.type === "mcq" ? data.correctOptionKey : "",
          codingLanguages: data.type === "coding" ? data.codingLanguages : [],
          starterCode: data.type === "coding" ? data.starterCode : {},
          testCases: data.type === "coding" ? data.testCases : [],
          constraints: data.type === "coding" ? data.constraints : "",
          inputFormat: data.type === "coding" ? data.inputFormat : "",
          outputFormat: data.type === "coding" ? data.outputFormat : "",
          examples: data.type === "coding" ? data.examples : [],
          timeLimitMs: data.type === "coding" ? data.timeLimitMs : 3000,
          memoryLimitMb: data.type === "coding" ? data.memoryLimitMb : 256,
        },
        { returnDocument: "after", runValidators: true },
      ),
    );
    if (!doc) throw new ActionError("Question not found.");

    const assessments = await op.runMongo(
      "sync assessment marks for question",
      () => Assessment.find({ questionIds: doc._id }),
    );
    for (const assessment of assessments) {
      const qs = await Question.find({ _id: { $in: assessment.questionIds } });
      assessment.totalMarks = qs.reduce((sum, q) => sum + q.points, 0);
      await assessment.save();
    }

    revalidatePath("/admin/questions");
    revalidatePath("/admin/assessments");
    revalidatePath("/student/assessments");
    op.success({ code: doc.code });
    return { question: serializeQuestion(doc) };
  } catch (error) {
    op.fail(error, { resourceId: id });
    return toError(error);
  }
}

export async function deleteQuestionAction(id: string) {
  const op = createServerOp({
    domain: "QUESTION",
    operation: "DELETE",
    source: "SERVER-ACTION",
    resourceId: id,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    await connectDB();

    const doc = await op.runMongo("fetching question for delete", () =>
      Question.findById(id),
    );
    if (!doc) throw new ActionError("Question not found.");

    const inUse = await op.runMongo("checking question references", () =>
      Assessment.countDocuments({ questionIds: doc._id }),
    );
    if (inUse > 0) {
      throw new ActionError(
        `Cannot delete: used in ${inUse} assessment(s). Remove it from assessments first.`,
      );
    }

    await op.runMongo("deleting question", () => doc.deleteOne());
    revalidatePath("/admin/questions");
    op.success({ code: doc.code });
    return { success: true };
  } catch (error) {
    op.fail(error, { resourceId: id });
    return toError(error);
  }
}

export async function getQuestionCategoryCountsAction() {
  const op = createServerOp({
    domain: "QUESTION",
    operation: "CATEGORY_COUNTS",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    await connectDB();

    const rows = await op.runMongo("aggregating category counts", () =>
      Question.aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$category", count: { $sum: 1 } } },
      ]),
    );
    const map = Object.fromEntries(rows.map((r) => [r._id, r.count]));
    op.success({ categories: rows.length });
    return { counts: map as Record<string, number> };
  } catch (error) {
    op.fail(error);
    throw error;
  }
}
