"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import {
  assertAssignableInterviewer,
  assertAssignableStudent,
  getAdminInterview,
  parseScheduledAtInput,
} from "@/lib/admin/interviews";
import { ActionError, requireAdmin } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { isValidObjectId } from "@/lib/interviewer/queries";
import {
  cancelInterviewSchema,
  createInterviewSchema,
  normalizeInterviewActionInput,
  updateInterviewSchema,
} from "@/lib/validators/interview-admin";
import { Interview } from "@/models/Interview";
import { InterviewEvaluation } from "@/models/InterviewEvaluation";

function revalidateInterviewSurfaces() {
  revalidatePath("/admin/interviews");
  revalidatePath("/interviewer");
  revalidatePath("/interviewer/interviews");
  revalidatePath("/interviewer/candidates");
  revalidatePath("/interviewer/evaluations");
  revalidatePath("/student/interviews");
  revalidatePath("/student");
  revalidatePath("/student/profile");
}

function parseInput<T>(schema: { parse: (raw: unknown) => T }, raw: unknown) {
  try {
    return schema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new ActionError(error.issues[0]?.message || "Invalid input.");
    }
    throw error;
  }
}

export async function createInterviewAction(raw: unknown) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "ADMIN_CREATE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin create interview");
    await connectDB();

    const input = parseInput(createInterviewSchema, normalizeInterviewActionInput(raw));
    await assertAssignableStudent(input.candidateId);
    await assertAssignableInterviewer(input.interviewerId);

    const doc = await Interview.create({
      candidateId: input.candidateId,
      interviewerId: input.interviewerId,
      createdBy: session.user.id,
      title: input.title,
      type: input.type,
      scheduledAt: parseScheduledAtInput(input.scheduledAt),
      durationMin: input.durationMin,
      status: "scheduled",
      meetingUrl: input.meetingUrl,
    });

    revalidateInterviewSurfaces();

    const interview = await getAdminInterview(doc._id.toString());
    return op.respond({ interview });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function updateInterviewAction(raw: unknown) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "ADMIN_UPDATE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin update interview");
    await connectDB();

    const input = parseInput(updateInterviewSchema, normalizeInterviewActionInput(raw));
    if (!isValidObjectId(input.interviewId)) {
      throw new ActionError("Interview not found.");
    }

    const interview = await Interview.findById(input.interviewId).lean();
    if (!interview) {
      throw new ActionError("Interview not found.");
    }

    if (interview.status === "cancelled") {
      throw new ActionError("Cancelled interviews cannot be updated.");
    }

    const hasEvaluation = Boolean(
      await InterviewEvaluation.exists({ interviewId: interview._id }),
    );

    const update: Record<string, unknown> = {};

    if (input.title !== undefined) update.title = input.title;
    if (input.type !== undefined) update.type = input.type;
    if (input.durationMin !== undefined) update.durationMin = input.durationMin;
    if (input.meetingUrl !== undefined) update.meetingUrl = input.meetingUrl;

    const reassignmentRequested =
      (input.candidateId !== undefined &&
        input.candidateId !== interview.candidateId.toString()) ||
      (input.interviewerId !== undefined &&
        input.interviewerId !== interview.interviewerId.toString());
    const scheduleChangeRequested = input.scheduledAt !== undefined;

    if (hasEvaluation && reassignmentRequested) {
      throw new ActionError(
        "Cannot reassign an interview that already has an evaluation.",
      );
    }

    if (interview.status === "completed") {
      if (reassignmentRequested || scheduleChangeRequested) {
        throw new ActionError(
          "Completed interviews cannot be reassigned or rescheduled.",
        );
      }
      if (input.durationMin !== undefined || input.type !== undefined) {
        throw new ActionError("Completed interviews cannot change schedule details.");
      }
    }

    if (interview.status === "in_progress") {
      if (reassignmentRequested || scheduleChangeRequested) {
        throw new ActionError(
          "In-progress interviews cannot be reassigned or rescheduled.",
        );
      }
    }

    if (input.candidateId !== undefined) {
      await assertAssignableStudent(input.candidateId);
      update.candidateId = input.candidateId;
    }
    if (input.interviewerId !== undefined) {
      await assertAssignableInterviewer(input.interviewerId);
      update.interviewerId = input.interviewerId;
    }
    if (input.scheduledAt !== undefined) {
      update.scheduledAt = parseScheduledAtInput(input.scheduledAt);
    }

    const updated = await Interview.findOneAndUpdate(
      { _id: input.interviewId, status: interview.status },
      { $set: update },
      { new: true },
    ).lean();

    if (!updated) {
      throw new ActionError("Unable to update interview. Please refresh and try again.");
    }

    revalidateInterviewSurfaces();

    const serialized = await getAdminInterview(updated._id.toString());
    return op.respond({ interview: serialized });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function cancelInterviewAction(raw: unknown) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "ADMIN_CANCEL",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin cancel interview");
    await connectDB();

    const input = parseInput(cancelInterviewSchema, raw);
    if (!isValidObjectId(input.interviewId)) {
      throw new ActionError("Interview not found.");
    }

    const interview = await Interview.findById(input.interviewId).lean();
    if (!interview) {
      throw new ActionError("Interview not found.");
    }

    if (interview.status === "cancelled") {
      const serialized = await getAdminInterview(interview._id.toString());
      return op.respond({ interview: serialized });
    }

    if (interview.status === "completed") {
      throw new ActionError("Completed interviews cannot be cancelled.");
    }

    const hasEvaluation = Boolean(
      await InterviewEvaluation.exists({ interviewId: interview._id }),
    );
    if (hasEvaluation) {
      throw new ActionError("Evaluated interviews cannot be cancelled.");
    }

    const updated = await Interview.findOneAndUpdate(
      {
        _id: input.interviewId,
        status: { $in: ["scheduled", "in_progress"] },
      },
      { $set: { status: "cancelled" } },
      { new: true },
    ).lean();

    if (!updated) {
      throw new ActionError("Unable to cancel interview.");
    }

    revalidateInterviewSurfaces();

    const serialized = await getAdminInterview(updated._id.toString());
    return op.respond({ interview: serialized });
  } catch (error) {
    return op.respondError(error);
  }
}
