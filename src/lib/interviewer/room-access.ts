import { connectDB } from "@/lib/db";
import { isInterviewJoinable } from "@/lib/interviewer/lifecycle";
import {
  getInterviewForParticipant,
  isValidObjectId,
} from "@/lib/interviewer/queries";
import type { InterviewParticipantRole } from "@/lib/livekit/room";
import type { UserRole } from "@/types/user";

export type AuthorizedInterviewRoomAccess = {
  interviewId: string;
  participantRole: InterviewParticipantRole;
  displayName: string;
  durationMin: number;
  status: string;
};

/**
 * Shared ownership + joinability gate for room pages and token issuance.
 */
export async function authorizeInterviewRoomAccess(
  interviewId: string,
  userId: string,
  role: UserRole,
  displayName: string,
): Promise<AuthorizedInterviewRoomAccess | null> {
  if (!isValidObjectId(interviewId)) {
    return null;
  }

  if (role !== "student" && role !== "interviewer") {
    return null;
  }

  await connectDB();

  const interview = await getInterviewForParticipant(
    interviewId,
    userId,
    role,
  );

  if (!interview || !isInterviewJoinable(interview.status)) {
    return null;
  }

  return {
    interviewId,
    participantRole: role,
    displayName: displayName || "Participant",
    durationMin: interview.durationMin,
    status: interview.status,
  };
}
