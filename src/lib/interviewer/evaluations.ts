import { ActionError } from "@/lib/auth-guards";
import {
  getOwnedInterviewEvaluation,
  isValidObjectId,
} from "@/lib/interviewer/queries";
import { submitInterviewEvaluationSchema } from "@/lib/validators/interview-evaluation";
import { Interview } from "@/models/Interview";
import { InterviewEvaluation } from "@/models/InterviewEvaluation";

export async function submitOwnedInterviewEvaluation(
  interviewerId: string,
  raw: unknown,
) {
  const input = submitInterviewEvaluationSchema.parse(raw);

  if (!isValidObjectId(input.interviewId)) {
    throw new ActionError("Evaluation not available.");
  }

  const existing = await InterviewEvaluation.findOne({
    interviewId: input.interviewId,
  }).lean();

  if (existing) {
    if (existing.interviewerId.toString() === interviewerId) {
      const current = await getOwnedInterviewEvaluation(
        input.interviewId,
        interviewerId,
      );
      if (current) {
        return current;
      }
    }
    throw new ActionError("Evaluation not available.");
  }

  const interview = await Interview.findOne({
    _id: input.interviewId,
    interviewerId,
    status: "completed",
  }).lean();

  if (!interview) {
    throw new ActionError("Evaluation not available.");
  }

  try {
    await InterviewEvaluation.create({
      interviewId: interview._id,
      interviewerId: interview.interviewerId,
      candidateId: interview.candidateId,
      score: input.score,
      notes: input.notes,
      status: "submitted",
      submittedAt: new Date(),
    });
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code;
    if (code === 11000) {
      const current = await getOwnedInterviewEvaluation(
        input.interviewId,
        interviewerId,
      );
      if (current) {
        return current;
      }
    }
    throw new ActionError("Unable to submit evaluation.");
  }

  const saved = await getOwnedInterviewEvaluation(
    input.interviewId,
    interviewerId,
  );
  if (!saved) {
    throw new ActionError("Unable to submit evaluation.");
  }

  return saved;
}
