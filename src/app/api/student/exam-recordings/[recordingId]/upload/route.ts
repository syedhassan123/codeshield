import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { getStorageProvider } from "@/lib/storage";
import { consumeLocalUploadToken } from "@/lib/storage/local-upload-tokens";
import { ExamRecording } from "@/models/ExamRecording";

/**
 * Local-provider direct browser PUT for exam recordings.
 * Used only when STORAGE_PROVIDER=local. Production S3 uses presigned PUTs
 * that never hit this route.
 */
export async function PUT(
  req: Request,
  context: { params: Promise<{ recordingId: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recordingId } = await context.params;
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token || !consumeLocalUploadToken(token, recordingId, session.user.id)) {
    return NextResponse.json(
      { error: "Invalid or expired upload token" },
      { status: 403 },
    );
  }

  await connectDB();
  const recording = await ExamRecording.findById(recordingId);
  if (!recording || recording.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Recording not found" }, { status: 404 });
  }
  if (recording.storageProvider !== "local") {
    return NextResponse.json(
      { error: "Local upload is not available for this recording" },
      { status: 400 },
    );
  }
  if (recording.status === "READY" && recording.fileSizeBytes > 0) {
    return NextResponse.json({ ok: true, alreadyReady: true }, { status: 200 });
  }

  const contentType =
    req.headers.get("content-type") || recording.mimeType || "video/webm";
  const buffer = Buffer.from(await req.arrayBuffer());
  if (buffer.length <= 0) {
    return NextResponse.json({ error: "Empty recording body" }, { status: 400 });
  }

  const storage = await getStorageProvider();
  await storage.putObject({
    key: recording.storageKey,
    body: buffer,
    contentType,
  });

  console.log(
    `[EXAM-RECORDING] LOCAL_PUT_SUCCESS recordingId=${recordingId.slice(0, 8)}… fileSizeBytes=${buffer.length}`,
  );

  return NextResponse.json(
    { ok: true, fileSizeBytes: buffer.length },
    { status: 200 },
  );
}
