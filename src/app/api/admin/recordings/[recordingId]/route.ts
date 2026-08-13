import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { readRecordingBytesForAdmin } from "@/lib/actions/exam-recording";
import { consumeLocalPlaybackToken } from "@/lib/storage/local-playback-tokens";

/**
 * Admin-only local recording stream.
 * Required for <video src> playback when STORAGE_PROVIDER=local.
 * S3 uses signed URLs directly (no route needed).
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recordingId } = await context.params;
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token || !consumeLocalPlaybackToken(token, recordingId)) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }

  await connectDB();
  const payload = await readRecordingBytesForAdmin(recordingId);
  if (!payload) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
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
