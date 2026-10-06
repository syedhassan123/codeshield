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
import { randomBytes } from "crypto";
import {
  buildRecordingObjectKey,
  getStorageProvider,
  mintLocalPlaybackToken,
  readLocalRecordingFile,
} from "@/lib/storage";
import { storeLocalPlaybackToken } from "@/lib/storage/local-playback-tokens";
import { storeLocalUploadToken } from "@/lib/storage/local-upload-tokens";
import { ExamRecording } from "@/models/ExamRecording";
import { Attempt } from "@/models/Attempt";

const PRESIGN_EXPIRES_SECONDS = 900;

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

/** Safe exam-recording lifecycle logs — never log credentials or full URLs. */
function examRecLog(
  event: string,
  meta: Record<string, string | number | boolean | undefined | null> = {},
) {
  const parts = Object.entries(meta)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${v}`);
  console.log(
    `[EXAM-RECORDING] ${event}${parts.length ? ` ${parts.join(" ")}` : ""}`,
  );
}

function persistableRecordingError(
  error: unknown,
  fallback = "Recording upload failed.",
) {
  const message =
    error instanceof Error && error.message.trim()
      ? error.message
      : typeof error === "string" && error.trim()
        ? error
        : fallback;
  return message.slice(0, 500);
}

const beginSchema = z.object({
  attemptId: z.string().min(1),
  mimeType: z.string().min(1),
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
      status: "RECORDING",
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

    let doc;
    try {
      doc = await ExamRecording.create({
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
    } catch (error) {
      const raced = await ExamRecording.findOne({
        attemptId: attempt._id,
        userId: session.user.id,
        status: "RECORDING",
      }).sort({ createdAt: -1 });
      if (!raced) throw error;
      return {
        success: true as const,
        recordingId: raced._id.toString(),
        storageProvider: raced.storageProvider,
        reused: true as const,
      };
    }

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
      status: "RECORDING",
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

const uploadUrlSchema = z.object({
  attemptId: z.string().min(1),
  recordingId: z.string().min(1),
  durationSeconds: z.coerce.number().min(0).default(0),
});

const confirmUploadSchema = z.object({
  attemptId: z.string().min(1),
  recordingId: z.string().min(1),
  fileSizeBytes: z.coerce.number().int().positive(),
  durationSeconds: z.coerce.number().min(0).default(0),
});

/**
 * Issue a short-lived PUT URL so the browser can upload the recording
 * directly to storage (S3 presigned PUT, or local tokenized API route).
 * Does NOT accept video bytes.
 */
export async function getExamRecordingUploadUrlAction(raw: unknown) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "RECORDING_PRESIGN",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);

    const parsed = uploadUrlSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid recording upload request." };
    }

    examRecLog("PRESIGN_REQUEST_STARTED", {
      attemptId: maskId(parsed.data.attemptId),
      recordingId: maskId(parsed.data.recordingId),
      durationSeconds: parsed.data.durationSeconds,
    });

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

    if (recording.status === "READY" && recording.fileSizeBytes > 0) {
      examRecLog("PRESIGN_SUCCESS", {
        attemptId: maskId(parsed.data.attemptId),
        recordingId: maskId(recording._id.toString()),
        status: "READY",
        alreadyReady: true,
      });
      return {
        success: true as const,
        alreadyReady: true as const,
        recordingId: recording._id.toString(),
        status: "READY" as const,
      };
    }

    const claimed = await ExamRecording.findOneAndUpdate(
      {
        _id: recording._id,
        userId: session.user.id,
        status: { $in: ["RECORDING", "UPLOADING", "FAILED"] },
      },
      {
        $set: {
          status: "UPLOADING",
          endedAt: new Date(),
          durationSeconds: parsed.data.durationSeconds,
          errorMessage: "",
        },
      },
      { returnDocument: "after" },
    );

    if (!claimed) {
      const latest = await ExamRecording.findById(recording._id);
      if (latest?.status === "READY" && latest.fileSizeBytes > 0) {
        return {
          success: true as const,
          alreadyReady: true as const,
          recordingId: latest._id.toString(),
          status: "READY" as const,
        };
      }
      throw new ActionError("Recording could not be finalized.");
    }

    const contentType = claimed.mimeType || "video/webm";
    const storage = await getStorageProvider();

    if (storage.name === "s3") {
      if (!storage.getSignedPutUrl) {
        throw new ActionError("S3 upload URL is not available.");
      }
      const uploadUrl = await storage.getSignedPutUrl(
        claimed.storageKey,
        contentType,
        PRESIGN_EXPIRES_SECONDS,
      );
      examRecLog("PRESIGN_SUCCESS", {
        attemptId: maskId(parsed.data.attemptId),
        recordingId: maskId(claimed._id.toString()),
        storageProvider: "s3",
        mimeType: contentType,
        expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      });
      op.success({ recordingId: claimed._id.toString(), provider: "s3" });
      return {
        success: true as const,
        alreadyReady: false as const,
        recordingId: claimed._id.toString(),
        uploadUrl,
        method: "PUT" as const,
        headers: { "Content-Type": contentType },
        expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
        storageProvider: "s3" as const,
        mimeType: contentType,
      };
    }

    const token = randomBytes(24).toString("hex");
    storeLocalUploadToken(
      token,
      claimed._id.toString(),
      session.user.id,
      PRESIGN_EXPIRES_SECONDS * 1000,
    );
    const uploadUrl = `/api/student/exam-recordings/${claimed._id.toString()}/upload?token=${token}`;
    examRecLog("PRESIGN_SUCCESS", {
      attemptId: maskId(parsed.data.attemptId),
      recordingId: maskId(claimed._id.toString()),
      storageProvider: "local",
      mimeType: contentType,
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
    });
    op.success({ recordingId: claimed._id.toString(), provider: "local" });
    return {
      success: true as const,
      alreadyReady: false as const,
      recordingId: claimed._id.toString(),
      uploadUrl,
      method: "PUT" as const,
      headers: { "Content-Type": contentType },
      expiresInSeconds: PRESIGN_EXPIRES_SECONDS,
      storageProvider: "local" as const,
      mimeType: contentType,
    };
  } catch (error) {
    op.fail(error);
    examRecLog("PRESIGN_FAILED", {
      error: persistableRecordingError(error, "Could not prepare upload."),
    });
    if (error instanceof ActionError) {
      return { success: false as const, error: persistableRecordingError(error) };
    }
    return {
      success: false as const,
      error: persistableRecordingError(error, "Could not prepare upload."),
    };
  }
}

/**
 * Confirm browser→storage upload completed. Marks READY only after the
 * object exists in storage. Does NOT accept video bytes.
 */
export async function confirmExamRecordingUploadAction(raw: unknown) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "RECORDING_CONFIRM",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);

    const parsed = confirmUploadSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid upload confirmation." };
    }

    examRecLog("UPLOAD_CONFIRM_STARTED", {
      attemptId: maskId(parsed.data.attemptId),
      recordingId: maskId(parsed.data.recordingId),
      fileSizeBytes: parsed.data.fileSizeBytes,
      durationSeconds: parsed.data.durationSeconds,
    });

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

    if (recording.status === "READY" && recording.fileSizeBytes > 0) {
      examRecLog("UPLOAD_CONFIRM_SUCCESS", {
        recordingId: maskId(recording._id.toString()),
        status: "READY",
        alreadyReady: true,
        fileSizeBytes: recording.fileSizeBytes,
      });
      return {
        success: true as const,
        recordingId: recording._id.toString(),
        status: "READY" as const,
      };
    }

    if (!["UPLOADING", "FAILED", "RECORDING"].includes(recording.status)) {
      throw new ActionError("Recording is not awaiting upload confirmation.");
    }

    const storage = await getStorageProvider();
    const head = storage.headObject
      ? await storage.headObject(recording.storageKey)
      : null;

    if (!head || head.contentLength <= 0) {
      examRecLog("UPLOAD_CONFIRM_FAILED", {
        recordingId: maskId(recording._id.toString()),
        reason: "object_missing",
      });
      recording.status = "FAILED";
      recording.endedAt = recording.endedAt || new Date();
      recording.errorMessage = "Recording object was not found in storage.";
      await recording.save();
      return {
        success: false as const,
        error: "Recording upload could not be verified in storage.",
        status: "FAILED" as const,
      };
    }

    const fileSizeBytes = Math.max(parsed.data.fileSizeBytes, head.contentLength);
    recording.fileSizeBytes = fileSizeBytes;
    recording.durationSeconds = parsed.data.durationSeconds;
    recording.endedAt = recording.endedAt || new Date();
    recording.status = "READY";
    recording.errorMessage = "";
    await recording.save();

    examRecLog("UPLOAD_CONFIRM_SUCCESS", {
      recordingId: maskId(recording._id.toString()),
      status: "READY",
      fileSizeBytes,
      durationSeconds: parsed.data.durationSeconds,
      mimeType: recording.mimeType,
    });
    recLog([
      "Upload confirmed",
      `attemptId=${maskId(parsed.data.attemptId)}`,
      `recordingId=${maskId(recording._id.toString())}`,
      `bytes=${fileSizeBytes}`,
    ]);
    op.success({ recordingId: recording._id.toString(), status: "READY" });
    return {
      success: true as const,
      recordingId: recording._id.toString(),
      status: "READY" as const,
    };
  } catch (error) {
    op.fail(error);
    examRecLog("UPLOAD_CONFIRM_FAILED", {
      error: persistableRecordingError(error),
    });
    if (error instanceof ActionError) {
      return { success: false as const, error: persistableRecordingError(error) };
    }
    return {
      success: false as const,
      error: persistableRecordingError(error),
    };
  }
}

/**
 * @deprecated Exam client uploads via getExamRecordingUploadUrlAction +
 * confirmExamRecordingUploadAction (direct browser→S3). Kept temporarily
 * for backwards compatibility; do not use for new exam recording uploads.
 */
export async function uploadExamRecordingAction(_formData: FormData) {
  return {
    success: false as const,
    error:
      "Direct server upload is disabled. Use the presigned upload flow instead.",
  };
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
          // Never overwrite a successfully uploaded recording.
          status: { $ne: "READY" },
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
