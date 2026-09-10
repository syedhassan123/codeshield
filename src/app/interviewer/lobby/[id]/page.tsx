import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { isInterviewJoinable } from "@/lib/interviewer/lifecycle";
import { getInterviewForParticipant } from "@/lib/interviewer/queries";
import { isLiveKitConfigured } from "@/lib/livekit/config";
import { InterviewLobbyClient } from "./lobby-client";

export default async function InterviewLobbyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  if (session.user.role !== "student" && session.user.role !== "interviewer") {
    notFound();
  }

  await connectDB();
  const interview = await getInterviewForParticipant(
    id,
    session.user.id,
    session.user.role,
  );

  if (!interview || !isInterviewJoinable(interview.status)) {
    notFound();
  }

  return (
    <InterviewLobbyClient
      interview={interview}
      interviewId={id}
      participantRole={session.user.role}
      livekitConfigured={isLiveKitConfigured()}
    />
  );
}
