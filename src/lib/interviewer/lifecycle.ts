import { ActionError } from "@/lib/auth-guards";
import { isValidObjectId } from "@/lib/interviewer/queries";
import { Interview } from "@/models/Interview";
import type { InterviewStatus } from "@/types/interview";

export function isInterviewJoinable(status: InterviewStatus) {
  return status === "scheduled" || status === "in_progress";
}

/**
 * Interviewer-owned transition: scheduled → in_progress.
 * Idempotent when already in_progress.
 */
export async function startOwnedInterview(
  interviewerId: string,
  interviewId: string,
) {
  if (!isValidObjectId(interviewId)) {
    throw new ActionError("Interview not found.");
  }

  const started = await Interview.findOneAndUpdate(
    { _id: interviewId, interviewerId, status: "scheduled" },
    { $set: { status: "in_progress" } },
    { new: true },
  ).lean();

  if (started) {
    return started;
  }

  const inProgress = await Interview.findOne({
    _id: interviewId,
    interviewerId,
    status: "in_progress",
  }).lean();

  if (inProgress) {
    return inProgress;
  }

  throw new ActionError("Interview cannot be started.");
}

/**
 * Interviewer-owned transition: in_progress → completed.
 * Idempotent when already completed.
 */
export async function completeOwnedInterview(
  interviewerId: string,
  interviewId: string,
) {
  if (!isValidObjectId(interviewId)) {
    throw new ActionError("Interview not found.");
  }

  const completed = await Interview.findOneAndUpdate(
    { _id: interviewId, interviewerId, status: "in_progress" },
    { $set: { status: "completed" } },
    { new: true },
  ).lean();

  if (completed) {
    return completed;
  }

  const alreadyCompleted = await Interview.findOne({
    _id: interviewId,
    interviewerId,
    status: "completed",
  }).lean();

  if (alreadyCompleted) {
    return alreadyCompleted;
  }

  throw new ActionError("Interview cannot be completed.");
}
