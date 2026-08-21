"use server";

import { z } from "zod";
import { ActionError, requireAdmin, requireStudent } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import {
  createServerOp,
  debugLog,
  isVerboseDebugEnabled,
  maskId,
} from "@/lib/debug";
import { getOwnedAttempt } from "@/lib/exam/finalize";
import {
  buildRecordingObjectKey,
  getStorageProvider,
  mintLocalPlaybackToken,
  readLocalRecordingFile,
} from "@/lib/storage";
import { storeLocalPlaybackToken } from "@/lib/storage/local-playback-tokens";
import { ExamRecording } from "@/models/ExamRecording";
import { Attempt } from "@/models/Attempt";

function camLog(lines: string[]) {
  if (!isVerboseDebugEnabled()) return;
  console.log("");
  console.log("[CAMERA]");
  for (const line of lines) console.log(line);
  console.log("");
}

function recLog(lines: string[]) {
  if (!isVerboseDebugEnabled()) return;
  console.log("");
  console.log("[RECORDING]");
  for (const line of lines) console.log(line);
  console.log("");
}

const beginSchema = z.object({
  attemptId: z.string().min(1),
  mimeType: z.string().min(1),
});

const uploadSchema = z.object({
  attemptId: z.string().min(1),
  recordingId: z.string().min(1),
  durationSeconds: z.coerce.number().min(0).default(0),
});

export async function beginExamRecordingAction(raw: unknown) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "RECORDING_BEGIN",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);
    const data = beginSchema.parse(raw);
    await connectDB();

    const attempt = await getOwnedAttempt(data.attemptId, session.user.id);
    if (attempt.status !== "in_progress") {
      throw new ActionError("Exam attempt is not active.");
    }

    const existing = await ExamRecording.findOne({
      attemptId: attempt._id,
      userId: session.user.id,
      status: { $in: ["RECORDING", "UPLOADING"] },
    }).sort({ createdAt: -1 });

    if (existing) {
      debugLog("EXAM", "RECORDING_REUSED", {
        attemptId: maskId(data.attemptId),
        recordingId: maskId(existing._id.toString()),
      });
      return {
        success: true as const,
        recordingId: existing._id.toString(),
        storageProvider: existing.storageProvider,
        reused: true as const,
      };
    }

    const storage = await getStorageProvider();
    const storageKey = buildRecordingObjectKey({
      attemptId: attempt._id.toString(),
      mimeType: data.mimeType,
    });

    const doc = await ExamRecording.create({
      attemptId: attempt._id,
      userId: attempt.studentId,
      assessmentId: attempt.assessmentId,
      storageKey,
      storageProvider: storage.name,
      mimeType: data.mimeType,
      durationSeconds: 0,
      fileSizeBytes: 0,
      startedAt: new Date(),
      endedAt: null,
      status: "RECORDING",
    });

    camLog([
      "Recording started",
      `attemptId=${maskId(data.attemptId)}`,
      `provider=${storage.name}`,
    ]);
    debugLog("EXAM", "RECORDING_STARTED", {
      attemptId: maskId(data.attemptId),
      recordingId: maskId(doc._id.toString()),
    });

    op.success({ recordingId: doc._id.toString() });
    return {
      success: true as const,
      recordingId: doc._id.toString(),
      storageProvider: storage.name,
    };
  } catch (error) {
    op.fail(error);
    if (error instanceof ActionError) {
      return { success: false as const, error: error.message };
    }
    return { success: false as const, error: "Could not start recording metadata." };
  }
}

/** Student: active recording row for an in-progress attempt (resume after refresh). */
export async function getActiveExamRecordingAction(attemptId: string) {
  try {
    const session = await requireStudent();
    await connectDB();
    const attempt = await getOwnedAttempt(attemptId, session.user.id);
    if (attempt.status !== "in_progress") {
      return { success: true as const, recording: null };
    }

    const recording = await ExamRecording.findOne({
      attemptId: attempt._id,
      userId: session.user.id,
      status: { $in: ["RECORDING", "UPLOADING"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!recording) {
      return { success: true as const, recording: null };
    }

    return {
      success: true as const,
      recording: {
        id: recording._id.toString(),
        status: recording.status,
        mimeType: recording.mimeType,
      },
    };
  } catch (error) {
    if (error instanceof ActionError) {
      return { success: false as const, error: error.message };
    }
    return { success: false as const, error: "Could not load recording state." };
  }
}

/**
 * Finalize + upload recording after successful exam submit.
 * Accepts FormData: attemptId, recordingId, durationSeconds, file
 */
export async function uploadExamRecordingAction(formData: FormData) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "RECORDING_UPLOAD",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);

    const parsed = uploadSchema.safeParse({
      attemptId: formData.get("attemptId"),
      recordingId: formData.get("recordingId"),
      durationSeconds: formData.get("durationSeconds") ?? 0,
    });
    if (!parsed.success) {
      return { success: false as const, error: "Invalid recording upload." };
    }

    const file = formData.get("file");
    if (!(file instanceof File) || file.size <= 0) {
      return { success: false as const, error: "Recording file missing." };
    }

    await connectDB();
    const attempt = await getOwnedAttempt(
      parsed.data.attemptId,
      session.user.id,
    );

    const recording = await ExamRecording.findById(parsed.data.recordingId);
    if (!recording || recording.attemptId.toString() !== attempt._id.toString()) {
      throw new ActionError("Recording not found.");
    }
    if (recording.userId.toString() !== session.user.id) {
      throw new ActionError("Unauthorized");
    }

    if (recording.status === "READY") {
      return {
        success: true as const,
        recordingId: recording._id.toString(),
        status: "READY" as const,
      };
    }

    recording.status = "UPLOADING";
    recording.endedAt = new Date();
    recording.durationSeconds = parsed.data.durationSeconds;
    await recording.save();

    recLog([
      "Upload started",
      `attemptId=${maskId(parsed.data.attemptId)}`,
      `bytes=${file.size}`,
    ]);

    const storage = await getStorageProvider();
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await storage.putObject({
        key: recording.storageKey,
        body: buffer,
        contentType: recording.mimeType || file.type || "video/webm",
      });
      recording.fileSizeBytes = buffer.length;
      recording.status = "READY";
      recording.errorMessage = "";
      await recording.save();

      recLog([
        "Upload successful",
        `attemptId=${maskId(parsed.data.attemptId)}`,
        `recordingId=${maskId(recording._id.toString())}`,
      ]);
      op.success({ recordingId: recording._id.toString(), status: "READY" });
      return {
        success: true as const,
        recordingId: recording._id.toString(),
        status: "READY" as const,
      };
    } catch (uploadError) {
      recording.status = "FAILED";
      recording.errorMessage =
        uploadError instanceof Error
          ? uploadError.message
          : "Upload failed";
      await recording.save();
      recLog([
        "Upload failed",
        `attemptId=${maskId(parsed.data.attemptId)}`,
      ]);
      return {
        success: false as const,
        error: "Recording upload failed.",
        status: "FAILED" as const,
      };
    }
  } catch (error) {
    op.fail(error);
    if (error instanceof ActionError) {
      return { success: false as const, error: error.message };
    }
    return { success: false as const, error: "Recording upload failed." };
  }
}

export async function markExamRecordingFailedAction(raw: unknown) {
  const schema = z.object({
    attemptId: z.string().min(1),
    recordingId: z.string().optional(),
    errorMessage: z.string().optional(),
  });
  try {
    const session = await requireStudent();
    const data = schema.parse(raw);
    await connectDB();
    const attempt = await getOwnedAttempt(data.attemptId, session.user.id);
    if (data.recordingId) {
      await ExamRecording.findOneAndUpdate(
        {
          _id: data.recordingId,
          attemptId: attempt._id,
          userId: session.user.id,
        },
        {
          $set: {
            status: "FAILED",
            endedAt: new Date(),
            errorMessage: data.errorMessage?.slice(0, 500) || "Recording failed",
          },
        },
      );
    }
    return { success: true as const };
  } catch {
    return { success: false as const };
  }
}

export type SerializedExamRecording = {
  id: string;
  status: string;
  mimeType: string;
  durationSeconds: number;
  fileSizeBytes: number;
  startedAt: string;
  endedAt: string | null;
  storageProvider: string;
  errorMessage: string;
};

export async function getAttemptRecordingAction(attemptId: string) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "RECORDING_GET",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    await connectDB();

    const attempt = await Attempt.findById(attemptId).select("_id");
    if (!attempt) throw new ActionError("Attempt not found.");

    const recording = await ExamRecording.findOne({ attemptId: attempt._id })
      .sort({ createdAt: -1 })
      .lean();

    if (!recording) {
      return op.respond({ recording: null }, 200);
    }

    const serialized: SerializedExamRecording = {
      id: recording._id.toString(),
      status: recording.status,
      mimeType: recording.mimeType,
      durationSeconds: recording.durationSeconds ?? 0,
      fileSizeBytes: recording.fileSizeBytes ?? 0,
      startedAt: new Date(recording.startedAt).toISOString(),
      endedAt: recording.endedAt
        ? new Date(recording.endedAt).toISOString()
        : null,
      storageProvider: recording.storageProvider,
      errorMessage: recording.errorMessage ?? "",
    };

    return op.respond({ recording: serialized }, 200);
  } catch (error) {
    return op.respondError(error, 400);
  }
}

/** Admin-only: returns a short-lived playback URL (signed S3 or local token URL). */
export async function getRecordingPlaybackUrlAction(recordingId: string) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "RECORDING_PLAYBACK_URL",
    source: "SERVER-ACTION",
    resourceId: recordingId,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed({
      action: "view_recording",
      resource: `recording:${maskId(recordingId)}`,
      role: session.user.role,
    });
    await connectDB();

    const recording = await ExamRecording.findById(recordingId);
    if (!recording) throw new ActionError("Recording not found.");
    if (recording.status !== "READY") {
      throw new ActionError("Recording is not ready for playback.");
    }

    const storage = await getStorageProvider();
    if (recording.storageProvider === "s3" && storage.name === "s3") {
      const url = await storage.getSignedReadUrl(recording.storageKey, 600);
      return op.respond({ url, expiresInSeconds: 600 }, 200);
    }

    // Local: mint opaque token consumed by authenticated admin route.
    const token = mintLocalPlaybackToken();
    storeLocalPlaybackToken(token, recording._id.toString());
    const url = `/api/admin/recordings/${recording._id.toString()}?token=${token}`;
    return op.respond({ url, expiresInSeconds: 600 }, 200);
  } catch (error) {
    return op.respondError(error, 400);
  }
}

export async function readRecordingBytesForAdmin(recordingId: string) {
  const recording = await ExamRecording.findById(recordingId);
  if (!recording || recording.status !== "READY") return null;
  if (recording.storageProvider !== "local") return null;
  const bytes = await readLocalRecordingFile(recording.storageKey);
  return { bytes, mimeType: recording.mimeType, recording };
}
