import mongoose from "mongoose";
import { debugLog, maskId } from "@/lib/debug";
import {
  buildInterviewEgressFileOutput,
  createInterviewEgressClient,
  isEgressComplete,
  isEgressFailed,
  isInterviewEgressConfigured,
} from "@/lib/livekit/egress";
import { getInterviewRoomName } from "@/lib/livekit/room";
import {
  buildInterviewRecordingObjectKey,
  getStorageProvider,
  localRecordingFileExists,
  mintLocalPlaybackToken,
} from "@/lib/storage";
import { storeLocalPlaybackToken } from "@/lib/storage/local-playback-tokens";
import { Interview } from "@/models/Interview";
import { InterviewRecording } from "@/models/InterviewRecording";
import type { UserRole } from "@/types/user";
import {
  INTERVIEW_RECORDING_NOT_FOUND,
  type InterviewRecordingMode,
  type InterviewRecordingStatus,
} from "@/types/interview-recording";
import { isValidObjectId } from "@/lib/interviewer/queries";

const FINALIZE_TIMEOUT_MS = 12_000;
const ACTIVE_STATUSES: InterviewRecordingStatus[] = [
  "RECORDING",
  "UPLOADING",
];

export type InterviewRecordingNotFound = {
  ok: false;
  error: typeof INTERVIEW_RECORDING_NOT_FOUND;
};

export type StartedInterviewRecording = {
  ok: true;
  recordingId: string;
  status: InterviewRecordingStatus;
  mode: InterviewRecordingMode;
  reused: boolean;
};

export type FinalizedInterviewRecording = {
  ok: true;
  recordingId: string;
  status: InterviewRecordingStatus;
};

export type InterviewRecordingView = {
  ok: true;
  recordingId: string;
  status: InterviewRecordingStatus;
  playbackUrl: string | null;
  startedAt: string;
  endedAt: string | null;
  sizeBytes: number;
};

function notFound(): InterviewRecordingNotFound {
  return { ok: false, error: INTERVIEW_RECORDING_NOT_FOUND };
}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Recording finalize timed out.")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function findOwnedInterview(interviewId: string, interviewerId: string) {
  if (!isValidObjectId(interviewId) || !isValidObjectId(interviewerId)) {
    return null;
  }
  return Interview.findOne({
    _id: interviewId,
    interviewerId: new mongoose.Types.ObjectId(interviewerId),
  }).lean();
}

async function findInterviewIfExists(interviewId: string) {
  if (!isValidObjectId(interviewId)) return null;
  return Interview.findById(interviewId).lean();
}

export async function findActiveInterviewRecording(interviewId: string) {
  if (!isValidObjectId(interviewId)) return null;
  return InterviewRecording.findOne({
    interviewId: new mongoose.Types.ObjectId(interviewId),
    status: { $in: ACTIVE_STATUSES },
  }).sort({ createdAt: -1 });
}

export async function startOwnedInterviewRecording(
  interviewerId: string,
  interviewId: string,
): Promise<StartedInterviewRecording | InterviewRecordingNotFound> {
  const interview = await findOwnedInterview(interviewId, interviewerId);
  if (!interview) {
    return notFound();
  }
  if (interview.status !== "scheduled" && interview.status !== "in_progress") {
    return notFound();
  }

  const existing = await findActiveInterviewRecording(interviewId);
  if (existing) {
    return {
      ok: true,
      recordingId: existing._id.toString(),
      status: existing.status,
      mode: existing.mode,
      reused: true,
    };
  }

  const storage = await getStorageProvider();
  const useEgress = isInterviewEgressConfigured();
  const mode: InterviewRecordingMode = useEgress ? "egress" : "client";
  const mimeType = useEgress ? "video/mp4" : "video/webm";
  const storageKey = buildInterviewRecordingObjectKey({
    interviewId,
    mimeType,
  });

  let doc;
  try {
    doc = await InterviewRecording.create({
      interviewId: interview._id,
      status: "RECORDING",
      mode,
      egressId: "",
      storageKey,
      storageProvider: useEgress ? "s3" : storage.name,
      mimeType,
      startedAt: new Date(),
      endedAt: null,
      sizeBytes: 0,
      errorMessage: "",
    });
  } catch (error) {
    const raced = await findActiveInterviewRecording(interviewId);
    if (raced) {
      return {
        ok: true,
        recordingId: raced._id.toString(),
        status: raced.status,
        mode: raced.mode,
        reused: true,
      };
    }
    throw error;
  }

  if (useEgress) {
    try {
      const egress = createInterviewEgressClient();
      const info = await egress.startRoomCompositeEgress(
        getInterviewRoomName(interviewId),
        buildInterviewEgressFileOutput(storageKey),
      );
      doc.egressId = info.egressId || "";
      await doc.save();
    } catch (error) {
      const reason =
        error instanceof Error ? error.message : "egress start failed";
      debugLog("INTERVIEW", "RECORDING_EGRESS_FALLBACK", {
        interviewId: maskId(interviewId),
        reason,
      });
      doc.mode = "client";
      doc.mimeType = "video/webm";
      doc.storageProvider = storage.name;
      doc.errorMessage = reason.slice(0, 500);
      await doc.save();
    }
  }

  debugLog("INTERVIEW", "RECORDING_STARTED", {
    interviewId: maskId(interviewId),
    recordingId: maskId(doc._id.toString()),
    mode: doc.mode,
  });

  return {
    ok: true,
    recordingId: doc._id.toString(),
    status: doc.status,
    mode: doc.mode,
    reused: false,
  };
}

async function markFailed(
  recordingId: string,
  errorMessage: string,
) {
  const current = await InterviewRecording.findById(recordingId);
  if (!current || current.status === "READY") return current;
  current.status = "FAILED";
  current.endedAt = current.endedAt || new Date();
  current.errorMessage = errorMessage.slice(0, 500);
  await current.save();
  return current;
}

async function stopEgressAndSettle(recording: {
  _id: mongoose.Types.ObjectId;
  egressId: string;
  storageKey: string;
}) {
  const egress = createInterviewEgressClient();
  if (recording.egressId) {
    try {
      await egress.stopEgress(recording.egressId);
    } catch {
      // already stopped or missing — still reconcile
    }
  }

  const listed = await egress.listEgress(
    recording.egressId ? { egressId: recording.egressId } : undefined,
  );
  const info = recording.egressId
    ? listed.find((item) => item.egressId === recording.egressId) ?? listed[0]
    : listed[0];

  if (info && isEgressComplete(info.status)) {
    const claimed = await InterviewRecording.findOneAndUpdate(
      {
        _id: recording._id,
        status: { $ne: "READY" },
      },
      {
        $set: {
          status: "READY",
          endedAt: new Date(),
          errorMessage: "",
        },
      },
      { returnDocument: "after" },
    );
    return claimed;
  }

  if (info && isEgressFailed(info.status)) {
    return markFailed(recording._id.toString(), "LiveKit egress failed.");
  }

  throw new Error("Egress has not completed yet.");
}

export async function finalizeInterviewRecordingOnEnd(
  interviewerId: string,
  interviewId: string,
): Promise<FinalizedInterviewRecording | InterviewRecordingNotFound> {
  const interview = await findOwnedInterview(interviewId, interviewerId);
  if (!interview) {
    return notFound();
  }

  const recording = await findActiveInterviewRecording(interviewId);
  if (!recording) {
    const latest = await InterviewRecording.findOne({
      interviewId: interview._id,
    }).sort({ createdAt: -1 });
    if (!latest) {
      return { ok: true, recordingId: "", status: "FAILED" };
    }
    return {
      ok: true,
      recordingId: latest._id.toString(),
      status: latest.status,
    };
  }

  if (recording.status === "READY") {
    return {
      ok: true,
      recordingId: recording._id.toString(),
      status: "READY",
    };
  }

  try {
    if (recording.mode === "egress" && recording.egressId) {
      recording.status = "UPLOADING";
      recording.endedAt = recording.endedAt || new Date();
      await recording.save();
      const settled = await withTimeout(
        stopEgressAndSettle(recording),
        FINALIZE_TIMEOUT_MS,
      );
      return {
        ok: true,
        recordingId: recording._id.toString(),
        status: settled?.status ?? recording.status,
      };
    }

    if (recording.mode === "client") {
      if (recording.status === "RECORDING") {
        await markFailed(
          recording._id.toString(),
          "Recording was not uploaded before the interview ended.",
        );
        return {
          ok: true,
          recordingId: recording._id.toString(),
          status: "FAILED",
        };
      }
    }

    return {
      ok: true,
      recordingId: recording._id.toString(),
      status: recording.status,
    };
  } catch (error) {
    const failed = await markFailed(
      recording._id.toString(),
      error instanceof Error ? error.message : "Recording finalize failed.",
    );
    debugLog("INTERVIEW", "RECORDING_FINALIZE_FAILED", {
      interviewId: maskId(interviewId),
      recordingId: maskId(recording._id.toString()),
    });
    return {
      ok: true,
      recordingId: recording._id.toString(),
      status: failed?.status ?? "FAILED",
    };
  }
}

export async function uploadOwnedInterviewRecording(input: {
  interviewerId: string;
  interviewId: string;
  recordingId: string;
  file: Blob;
}) {
  const interview = await findOwnedInterview(input.interviewId, input.interviewerId);
  if (!interview) {
    return notFound();
  }

  const recording = await InterviewRecording.findById(input.recordingId);
  if (
    !recording ||
    recording.interviewId.toString() !== interview._id.toString()
  ) {
    return notFound();
  }

  if (recording.status === "READY" && recording.sizeBytes > 0) {
    return {
      ok: true as const,
      recordingId: recording._id.toString(),
      status: "READY" as const,
    };
  }

  const claimed = await InterviewRecording.findOneAndUpdate(
    {
      _id: recording._id,
      status: { $in: ["RECORDING", "UPLOADING", "FAILED"] },
    },
    {
      $set: {
        status: "UPLOADING",
        endedAt: new Date(),
      },
    },
    { returnDocument: "after" },
  );

  if (!claimed) {
    const latest = await InterviewRecording.findById(recording._id);
    if (latest?.status === "READY") {
      return {
        ok: true as const,
        recordingId: latest._id.toString(),
        status: "READY" as const,
      };
    }
    return notFound();
  }

  try {
    const buffer = Buffer.from(await input.file.arrayBuffer());
    if (buffer.length <= 0) {
      await markFailed(claimed._id.toString(), "Empty recording");
      return {
        ok: false as const,
        error: INTERVIEW_RECORDING_NOT_FOUND,
      };
    }

    const storage = await getStorageProvider();
    await storage.putObject({
      key: claimed.storageKey,
      body: buffer,
      contentType: claimed.mimeType || input.file.type || "video/webm",
    });
    claimed.sizeBytes = buffer.length;
    claimed.status = "READY";
    claimed.errorMessage = "";
    claimed.endedAt = claimed.endedAt || new Date();
    await claimed.save();
    return {
      ok: true as const,
      recordingId: claimed._id.toString(),
      status: "READY" as const,
    };
  } catch (error) {
    await markFailed(
      claimed._id.toString(),
      error instanceof Error ? error.message : "Recording upload failed.",
    );
    throw error;
  }
}

export async function reconcileInterviewRecording(interviewId: string) {
  if (!isValidObjectId(interviewId)) return null;
  const recording = await InterviewRecording.findOne({
    interviewId: new mongoose.Types.ObjectId(interviewId),
  }).sort({ createdAt: -1 });
  if (!recording) return null;
  if (recording.status === "READY") return recording;

  try {
    if (recording.mode === "egress" && recording.egressId && isInterviewEgressConfigured()) {
      const listed = await createInterviewEgressClient().listEgress({
        egressId: recording.egressId,
      });
      const info = listed[0];
      if (info && isEgressComplete(info.status)) {
        recording.status = "READY";
        recording.endedAt = recording.endedAt || new Date();
        recording.errorMessage = "";
        await recording.save();
        return recording;
      }
    }

    if (recording.storageProvider === "local") {
      const exists = await localRecordingFileExists(recording.storageKey);
      if (exists) {
        recording.status = "READY";
        recording.endedAt = recording.endedAt || new Date();
        recording.errorMessage = "";
        await recording.save();
        return recording;
      }
    }
  } catch (error) {
    debugLog("INTERVIEW", "RECORDING_RECONCILE_FAILED", {
      interviewId: maskId(interviewId),
      reason: error instanceof Error ? error.message : "reconcile failed",
    });
  }

  return recording;
}

export async function getInterviewRecordingForViewer(
  userId: string,
  role: UserRole,
  interviewId: string,
): Promise<InterviewRecordingView | InterviewRecordingNotFound> {
  const interview = await findInterviewIfExists(interviewId);
  if (!interview) {
    return notFound();
  }

  const ownsAsInterviewer =
    role === "interviewer" && interview.interviewerId.toString() === userId;
  if (role !== "admin" && !ownsAsInterviewer) {
    return notFound();
  }

  const recording = await reconcileInterviewRecording(interviewId);
  if (!recording) {
    return notFound();
  }

  let playbackUrl: string | null = null;
  if (recording.status === "READY") {
    if (recording.storageProvider === "s3") {
      const storage = await getStorageProvider();
      playbackUrl = await storage.getSignedReadUrl(recording.storageKey, 600);
    } else {
      const token = mintLocalPlaybackToken();
      storeLocalPlaybackToken(token, recording._id.toString());
      playbackUrl = `/api/interviews/${interviewId}/recording/file?token=${token}`;
    }
  }

  return {
    ok: true,
    recordingId: recording._id.toString(),
    status: recording.status,
    playbackUrl,
    startedAt: recording.startedAt.toISOString(),
    endedAt: recording.endedAt ? recording.endedAt.toISOString() : null,
    sizeBytes: recording.sizeBytes,
  };
}

export async function readInterviewRecordingBytesForViewer(
  userId: string,
  role: UserRole,
  interviewId: string,
  recordingId: string,
) {
  const view = await getInterviewRecordingForViewer(userId, role, interviewId);
  if (!view.ok || view.status !== "READY" || view.recordingId !== recordingId) {
    return null;
  }
  const recording = await InterviewRecording.findById(recordingId);
  if (!recording || recording.status !== "READY") return null;
  const { readLocalRecordingFile } = await import("@/lib/storage");
  const bytes = await readLocalRecordingFile(recording.storageKey);
  return {
    bytes,
    mimeType: recording.mimeType || "video/webm",
  };
}

/** Test helper: identical missing vs not-owned payload. */
export function interviewRecordingNotFoundBody() {
  return { ok: false as const, error: INTERVIEW_RECORDING_NOT_FOUND };
}
