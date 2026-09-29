"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  beginExamRecordingAction,
  getActiveExamRecordingAction,
  markExamRecordingFailedAction,
  uploadExamRecordingAction,
} from "@/lib/actions/exam-recording";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";
import {
  classifyCameraError,
  isGetUserMediaSupported,
  isMediaRecorderSupported,
  openCameraStream,
  pickSupportedRecorderMimeType,
  stopMediaStream,
  waitForRecorderStop,
} from "@/lib/camera/browser";

type Options = {
  attemptId: string;
  enabled: boolean;
  deviceId?: string | null;
};

export type ExamRecordingStatus =
  | "idle"
  | "initializing"
  | "recording"
  | "stopping"
  | "uploading"
  | "ready"
  | "failed";

const UPLOAD_RETRIES = 3;
const UPLOAD_RETRY_MS = 1500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Camera preview + MediaRecorder during an active exam.
 * Does not start until enabled=true (session in progress).
 * Stop the recorder during submit, then upload after answers are stored.
 */
export function useExamRecording({ attemptId, enabled, deviceId }: Options) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraWarning, setCameraWarning] = useState("");
  const [recordingStatus, setRecordingStatus] =
    useState<ExamRecordingStatus>("idle");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const mimeTypeRef = useRef("");
  const enabledRef = useRef(enabled);
  const startingRef = useRef(false);
  const finalizeInProgressRef = useRef(false);
  const readyRef = useRef(false);
  const trackEndedHandlerRef = useRef<(() => void) | null>(null);

  enabledRef.current = enabled;

  /** Call synchronously at submit click — blocks unmount cleanup from aborting upload. */
  const armRecordingFinalize = useCallback(() => {
    finalizeInProgressRef.current = true;
  }, []);

  const report = useCallback(
    async (
      eventType:
        | "CAMERA_PERMISSION_DENIED"
        | "CAMERA_UNAVAILABLE"
        | "CAMERA_DISCONNECTED"
        | "CAMERA_RECONNECTED"
        | "RECORDING_STARTED"
        | "RECORDING_STOPPED"
        | "RECORDING_UPLOAD_FAILED",
      metadata?: Record<string, unknown>,
    ) => {
      await recordExamSecurityEventAction({
        attemptId,
        eventType,
        metadata,
      });
    },
    [attemptId],
  );

  const detachTrackEndedHandler = useCallback(() => {
    const stream = streamRef.current;
    const handler = trackEndedHandlerRef.current;
    const track = stream?.getVideoTracks()[0];
    if (track && handler) {
      track.removeEventListener("ended", handler);
    }
    trackEndedHandlerRef.current = null;
  }, []);

  const attachPreview = useCallback(
    async (stream: MediaStream) => {
      detachTrackEndedHandler();
      stopMediaStream(streamRef.current);
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      const track = stream.getVideoTracks()[0];
      if (track) {
        const onEnded = () => {
          setCameraActive(false);
          setCameraWarning(
            "Camera disconnected. Your camera connection was interrupted. Please reconnect your camera.",
          );
          if (recorderRef.current?.state === "recording") {
            try {
              recorderRef.current.stop();
            } catch {
              // ignore
            }
          }
          setRecordingStatus((status) =>
            status === "ready" ? status : "failed",
          );
          void report("CAMERA_DISCONNECTED", { source: "trackended" });
        };
        trackEndedHandlerRef.current = onEnded;
        track.addEventListener("ended", onEnded);
      }
    },
    [detachTrackEndedHandler, report],
  );

  const bindRecorder = useCallback(
    (recorder: MediaRecorder, stream: MediaStream) => {
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      recorder.onerror = () => {
        setRecordingStatus("failed");
        setCameraWarning(
          "Recording was interrupted. Your session is still active, but the recording may be incomplete.",
        );
        void report("RECORDING_UPLOAD_FAILED", { reason: "mediarecorder_error" });
        void markExamRecordingFailedAction({
          attemptId,
          recordingId: recordingIdRef.current || undefined,
          errorMessage: "MediaRecorder error",
        });
        try {
          recorder.stop();
        } catch {
          // ignore
        }
        stopMediaStream(stream);
      };
      recorderRef.current = recorder;
      recorder.start(2000);
      setRecordingStatus("recording");
    },
    [attemptId, report],
  );

  const start = useCallback(async () => {
    if (!enabledRef.current || startingRef.current) return;
    startingRef.current = true;
    setRecordingStatus("initializing");
    setCameraWarning("");

    try {
      if (!isGetUserMediaSupported()) {
        throw new Error("This browser does not support camera access.");
      }
      if (!isMediaRecorderSupported()) {
        throw new Error("This browser cannot record video.");
      }

      const stream = await openCameraStream(deviceId || undefined);
      await attachPreview(stream);

      const mimeType = pickSupportedRecorderMimeType();
      mimeTypeRef.current = mimeType;
      chunksRef.current = [];

      const active = await getActiveExamRecordingAction(attemptId);
      let reused = false;
      if (active.success && active.recording) {
        reused = true;
        recordingIdRef.current = active.recording.id;
        mimeTypeRef.current = active.recording.mimeType || mimeType;
      } else {
        const begin = await beginExamRecordingAction({
          attemptId,
          mimeType: mimeType || "video/webm",
        });
        if (!begin.success || !("recordingId" in begin)) {
          setRecordingStatus("failed");
          setCameraWarning(begin.error || "Could not initialize recording.");
          return;
        }
        recordingIdRef.current = begin.recordingId;
        reused = Boolean("reused" in begin && begin.reused);
      }

      if (!recordingIdRef.current) {
        setRecordingStatus("failed");
        setCameraWarning("Could not initialize recording.");
        return;
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      bindRecorder(recorder, stream);
      if (!startedAtRef.current) {
        startedAtRef.current = Date.now();
      }
      if (!reused) {
        await report("RECORDING_STARTED");
      }
    } catch (err) {
      const classified = classifyCameraError(err);
      setCameraWarning(classified.message);
      setCameraActive(false);
      setRecordingStatus("failed");
      await report(
        classified.code === "PERMISSION_DENIED"
          ? "CAMERA_PERMISSION_DENIED"
          : "CAMERA_UNAVAILABLE",
        { phase: "session_start" },
      );
    } finally {
      startingRef.current = false;
    }
  }, [attemptId, attachPreview, bindRecorder, deviceId, report]);

  const reconnect = useCallback(async () => {
    setCameraWarning("");
    setRecordingStatus("initializing");
    try {
      const stream = await openCameraStream(deviceId || undefined);
      await attachPreview(stream);
      await report("CAMERA_RECONNECTED");

      if (
        recorderRef.current?.state === "inactive" ||
        !recorderRef.current
      ) {
        const mimeType =
          mimeTypeRef.current || pickSupportedRecorderMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        bindRecorder(recorder, stream);
      }
    } catch (err) {
      const classified = classifyCameraError(err);
      setCameraWarning(classified.message);
      setRecordingStatus("failed");
    }
  }, [attachPreview, bindRecorder, deviceId, report]);

  const pendingUploadRef = useRef<{
    blob: Blob;
    recordingId: string;
    durationSeconds: number;
  } | null>(null);
  const uploadInFlightRef = useRef<Promise<{
    success: boolean;
    error?: string;
  }> | null>(null);

  const uploadWithRetry = useCallback(
    async (formData: FormData) => {
      let lastError = "Recording upload failed.";
      for (let attempt = 0; attempt < UPLOAD_RETRIES; attempt += 1) {
        try {
          const uploaded = await uploadExamRecordingAction(formData);
          if (uploaded.success) {
            return uploaded;
          }
          lastError = uploaded.error || lastError;
        } catch (error) {
          lastError =
            error instanceof Error && error.message
              ? error.message
              : lastError;
        }
        if (attempt < UPLOAD_RETRIES - 1) {
          await sleep(UPLOAD_RETRY_MS * (attempt + 1));
        }
      }
      return { success: false as const, error: lastError };
    },
    [],
  );

  /**
   * Stop MediaRecorder and release the camera. Does not upload.
   * Call armRecordingFinalize() at submit click first. Never throws.
   */
  const stopRecordingForSubmit = useCallback(async () => {
    if (readyRef.current) {
      return { success: true as const };
    }
    finalizeInProgressRef.current = true;
    setRecordingStatus("stopping");

    try {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        await waitForRecorderStop(recorder);
      }

      await Promise.resolve();

      const parts = chunksRef.current;
      const blob =
        parts.length > 0
          ? new Blob(parts, {
              type:
                recorder?.mimeType || mimeTypeRef.current || "video/webm",
            })
          : null;

      const durationSeconds = Math.max(
        0,
        Math.round((Date.now() - (startedAtRef.current || Date.now())) / 1000),
      );

      try {
        void report("RECORDING_STOPPED", { durationSeconds });
      } catch {
        // Security-event logging must not block exam submit.
      }

      detachTrackEndedHandler();
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
      setCameraActive(false);

      if (!blob || !recordingIdRef.current) {
        setRecordingStatus("failed");
        try {
          await markExamRecordingFailedAction({
            attemptId,
            recordingId: recordingIdRef.current || undefined,
            errorMessage: "No recording data",
          });
        } catch {
          // ignore
        }
        try {
          await report("RECORDING_UPLOAD_FAILED", { reason: "empty_blob" });
        } catch {
          // ignore
        }
        return {
          success: false as const,
          error: "No recording data was captured.",
        };
      }

      pendingUploadRef.current = {
        blob,
        recordingId: recordingIdRef.current,
        durationSeconds,
      };
      return { success: true as const };
    } catch (error) {
      setRecordingStatus("failed");
      try {
        await markExamRecordingFailedAction({
          attemptId,
          recordingId: recordingIdRef.current || undefined,
          errorMessage: "Could not stop the camera recording.",
        });
      } catch {
        // ignore
      }
      return {
        success: false as const,
        error:
          error instanceof Error && error.message
            ? error.message
            : "Could not stop the camera recording.",
      };
    }
  }, [attemptId, detachTrackEndedHandler, report]);

  /**
   * Upload the blob prepared by stopRecordingForSubmit. Never throws —
   * exam answers are submitted independently afterward.
   */
  const uploadPreparedRecording = useCallback(async () => {
    if (readyRef.current) {
      return { success: true as const };
    }
    if (uploadInFlightRef.current) {
      return uploadInFlightRef.current as Promise<{
        success: true;
      } | {
        success: false;
        error: string;
      }>;
    }

    const run = (async () => {
    const pending = pendingUploadRef.current;
    if (!pending) {
      setRecordingStatus("failed");
      finalizeInProgressRef.current = false;
      return {
        success: false as const,
        error: "No recording data was captured.",
      };
    }

    setRecordingStatus("uploading");
    const formData = new FormData();
    formData.set("attemptId", attemptId);
    formData.set("recordingId", pending.recordingId);
    formData.set("durationSeconds", String(pending.durationSeconds));
    formData.set(
      "file",
      pending.blob,
      `exam-${attemptId}.${pending.blob.type.includes("mp4") ? "mp4" : "webm"}`,
    );

    try {
      const uploaded = await uploadWithRetry(formData);
      if (!uploaded.success) {
        setRecordingStatus("failed");
        try {
          await report("RECORDING_UPLOAD_FAILED", {
            reason: "upload_retries_exhausted",
          });
        } catch {
          // ignore
        }
        try {
          await markExamRecordingFailedAction({
            attemptId,
            recordingId: pending.recordingId,
            errorMessage: "Recording upload failed.",
          });
        } catch {
          // ignore
        }
        finalizeInProgressRef.current = false;
        return { success: false as const, error: uploaded.error };
      }
      setRecordingStatus("ready");
      readyRef.current = true;
      pendingUploadRef.current = null;
      finalizeInProgressRef.current = false;
      return { success: true as const };
    } catch (error) {
      setRecordingStatus("failed");
      try {
        await report("RECORDING_UPLOAD_FAILED", { reason: "upload_threw" });
      } catch {
        // ignore
      }
      try {
        await markExamRecordingFailedAction({
          attemptId,
          recordingId: pending.recordingId,
          errorMessage: "Recording upload failed.",
        });
      } catch {
        // ignore
      }
      finalizeInProgressRef.current = false;
      return {
        success: false as const,
        error:
          error instanceof Error && error.message
            ? error.message
            : "Recording upload failed.",
      };
    }
    })();

    uploadInFlightRef.current = run;
    try {
      return await run;
    } finally {
      uploadInFlightRef.current = null;
    }
  }, [attemptId, report, uploadWithRetry]);

  /**
   * Stop then upload. Prefer stopRecordingForSubmit + uploadPreparedRecording
   * around exam submit so a failed upload cannot block answers.
   */
  const finalizeAfterSubmit = useCallback(async () => {
    const stopped = await stopRecordingForSubmit();
    if (!stopped.success) return stopped;
    return uploadPreparedRecording();
  }, [stopRecordingForSubmit, uploadPreparedRecording]);

  useEffect(() => {
    if (!enabled) return;
    void start();
    return () => {
      if (finalizeInProgressRef.current) return;
      detachTrackEndedHandler();
      try {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      recorderRef.current = null;
    };
    // intentionally once per attempt session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, attemptId]);

  return {
    videoRef,
    cameraActive,
    cameraWarning,
    recordingStatus,
    reconnect,
    armRecordingFinalize,
    stopRecordingForSubmit,
    uploadPreparedRecording,
    finalizeAfterSubmit,
  };
}
