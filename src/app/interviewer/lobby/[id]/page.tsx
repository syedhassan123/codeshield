import Link from "next/link";
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

  if (!interview) {
    notFound();
  }

  if (!isInterviewJoinable(interview.status)) {
    const backHref =
      session.user.role === "student"
        ? "/student/interviews"
        : "/interviewer/interviews";
    const ended = interview.status === "completed";

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-display font-bold text-xl">
            {ended ? "This interview has ended" : "This interview was cancelled"}
          </h1>
          <p className="text-sm text-slate-400">
            {interview.title} · {interview.candidateName}
          </p>
          <div className="flex gap-3 justify-center">
            {ended && session.user.role === "interviewer" ? (
              <Link
                href={`/interviewer/evaluations/${id}`}
                className="inline-flex px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
              >
                Open evaluation
              </Link>
            ) : null}
            <Link
              href={backHref}
              className="inline-flex px-4 py-2 rounded-lg border border-slate-700 text-sm font-semibold"
            >
              Back to interviews
            </Link>
          </div>
        </div>
      </div>
    );
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
