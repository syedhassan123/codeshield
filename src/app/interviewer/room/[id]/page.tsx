import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getInterviewForParticipant } from "@/lib/interviewer/queries";
import { InterviewRoomClient } from "./room-client";

export default async function InterviewRoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    notFound();
  }

  await connectDB();
  const interview = await getInterviewForParticipant(
    id,
    session.user.id,
    session.user.role,
  );

  if (!interview) {
    notFound();
  }

  return <InterviewRoomClient interview={interview} />;
}
