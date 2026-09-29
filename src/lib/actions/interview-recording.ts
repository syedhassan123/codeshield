"use server";

import { requireSession } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import {
  finalizeInterviewRecordingOnEnd,
  getInterviewRecordingForViewer,
  startOwnedInterviewRecording,
  uploadOwnedInterviewRecording,
} from "@/lib/interview-recording/service";
import { INTERVIEW_RECORDING_NOT_FOUND } from "@/types/interview-recording";

function notFoundResponse() {
  return { error: INTERVIEW_RECORDING_NOT_FOUND };
}

export async function startInterviewRecordingAction(interviewId: string) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "RECORDING_START",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireSession();
    op.auth(session.user);
    await connectDB();

    if (session.user.role !== "interviewer") {
      op.denied("interview recording start not interviewer");
      return notFoundResponse();
    }

    const result = await startOwnedInterviewRecording(
      session.user.id,
      interviewId,
    );
    if (!result.ok) {
      op.denied("interview recording start unauthorized");
      return notFoundResponse();
    }

    op.allowed("start interview recording");
    return op.respond({
      recordingId: result.recordingId,
      status: result.status,
      mode: result.mode,
      reused: result.reused,
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function finalizeInterviewRecordingAction(interviewId: string) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "RECORDING_FINALIZE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireSession();
    op.auth(session.user);
    await connectDB();

    if (session.user.role !== "interviewer") {
      op.denied("interview recording finalize not interviewer");
      return notFoundResponse();
    }

    const result = await finalizeInterviewRecordingOnEnd(
      session.user.id,
      interviewId,
    );
    if (!result.ok) {
      op.denied("interview recording finalize unauthorized");
      return notFoundResponse();
    }

    op.allowed("finalize interview recording");
    return op.respond({
      recordingId: result.recordingId,
      status: result.status,
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function uploadInterviewRecordingAction(formData: FormData) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "RECORDING_UPLOAD",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireSession();
    op.auth(session.user);
    await connectDB();

    if (session.user.role !== "interviewer") {
      op.denied("interview recording upload not interviewer");
      return notFoundResponse();
    }

    const interviewId = String(formData.get("interviewId") || "");
    const recordingId = String(formData.get("recordingId") || "");
    const file = formData.get("file");
    if (!(file instanceof Blob) || file.size <= 0) {
      return notFoundResponse();
    }

    const result = await uploadOwnedInterviewRecording({
      interviewerId: session.user.id,
      interviewId,
      recordingId,
      file,
    });
    if (!result.ok) {
      op.denied("interview recording upload unauthorized");
      return notFoundResponse();
    }

    op.allowed("upload interview recording");
    return op.respond({
      recordingId: result.recordingId,
      status: result.status,
    });
  } catch (error) {
    op.fail(error);
    return { error: "Recording upload failed." };
  }
}

export async function getInterviewRecordingPlaybackAction(interviewId: string) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "RECORDING_PLAYBACK",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireSession();
    op.auth(session.user);
    await connectDB();

    const result = await getInterviewRecordingForViewer(
      session.user.id,
      session.user.role,
      interviewId,
    );
    if (!result.ok) {
      op.denied("interview recording playback unauthorized");
      return notFoundResponse();
    }

    op.allowed("play interview recording");
    return op.respond({
      recordingId: result.recordingId,
      status: result.status,
      playbackUrl: result.playbackUrl,
      startedAt: result.startedAt,
      endedAt: result.endedAt,
      sizeBytes: result.sizeBytes,
    });
  } catch (error) {
    return op.respondError(error);
  }
}
