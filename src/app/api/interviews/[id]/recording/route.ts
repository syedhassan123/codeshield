import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { getInterviewRecordingForViewer } from "@/lib/interview-recording/service";
import { INTERVIEW_RECORDING_NOT_FOUND } from "@/types/interview-recording";

const NOT_FOUND = { error: INTERVIEW_RECORDING_NOT_FOUND };

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: interviewId } = await context.params;
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "RECORDING_GET",
    source: "API",
  });

  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      op.denied("interview recording unauthenticated");
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    op.auth(session.user);
    await connectDB();

    const result = await getInterviewRecordingForViewer(
      session.user.id,
      session.user.role,
      interviewId,
    );
    if (!result.ok || result.status !== "READY" || !result.playbackUrl) {
      op.denied("interview recording unauthorized or not ready");
      return NextResponse.json(NOT_FOUND, { status: 404 });
    }

    op.allowed("interview recording playback metadata");
    return NextResponse.json({
      recordingId: result.recordingId,
      status: result.status,
      playbackUrl: result.playbackUrl,
    });
  } catch (error) {
    op.respondError(error);
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }
}
