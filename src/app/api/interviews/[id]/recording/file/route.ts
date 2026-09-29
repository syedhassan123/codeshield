import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { readInterviewRecordingBytesForViewer } from "@/lib/interview-recording/service";
import { consumeLocalPlaybackToken } from "@/lib/storage/local-playback-tokens";
import { INTERVIEW_RECORDING_NOT_FOUND } from "@/types/interview-recording";
import { InterviewRecording } from "@/models/InterviewRecording";

const NOT_FOUND = { error: INTERVIEW_RECORDING_NOT_FOUND };

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const { id: interviewId } = await context.params;
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  await connectDB();
  const recording = await InterviewRecording.findOne({
    interviewId,
    status: "READY",
  }).sort({ createdAt: -1 });
  if (!recording) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  if (!consumeLocalPlaybackToken(token, recording._id.toString())) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  const payload = await readInterviewRecordingBytesForViewer(
    session.user.id,
    session.user.role,
    interviewId,
    recording._id.toString(),
  );
  if (!payload) {
    return NextResponse.json(NOT_FOUND, { status: 404 });
  }

  return new NextResponse(new Uint8Array(payload.bytes), {
    status: 200,
    headers: {
      "Content-Type": payload.mimeType || "video/webm",
      "Content-Length": String(payload.bytes.length),
      "Cache-Control": "private, no-store",
    },
  });
}
