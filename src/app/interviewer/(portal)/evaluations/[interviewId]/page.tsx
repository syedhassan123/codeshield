import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { getInterviewRecordingForViewer } from "@/lib/interview-recording/service";
import { getEvaluationFormContext } from "@/lib/interviewer/queries";
import { requirePageRole } from "@/lib/safe-auth";
import { EvaluationFormClient } from "./evaluation-form-client";

export default async function EvaluationFormPage({
  params,
}: {
  params: Promise<{ interviewId: string }>;
}) {
  const session = await requirePageRole(["interviewer"]);
  const { interviewId } = await params;

  await connectDB();
  const context = await getEvaluationFormContext(interviewId, session.user.id);

  if (!context) {
    notFound();
  }

  const recording = await getInterviewRecordingForViewer(
    session.user.id,
    session.user.role,
    interviewId,
  );

  return (
    <EvaluationFormClient
      context={{
        ...context,
        recording: recording.ok
          ? {
              status: recording.status,
              playbackUrl: recording.playbackUrl,
            }
          : null,
      }}
    />
  );
}
