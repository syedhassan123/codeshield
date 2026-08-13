"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  beginExamRecordingAction,
  markExamRecordingFailedAction,
  uploadExamRecordingAction,
} from "@/lib/actions/exam-recording";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";
import {
  classifyCameraError,
  openCameraStream,
  pickSupportedRecorderMimeType,
  stopMediaStream,
} from "@/lib/camera/browser";

type Options = {
  attemptId: string;
  enabled: boolean;
  deviceId?: string | null;
};

/**
 * Camera preview + MediaRecorder during an active exam.
 * Does not start until enabled=true (session in progress).
 * Stop/upload only via finalizeAfterSubmit (after successful exam submit).
 */
export function useExamRecording({ attemptId, enabled, deviceId }: Options) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraWarning, setCameraWarning] = useState("");
  const [recordingStatus, setRecordingStatus] = useState<
    "idle" | "recording" | "stopping" | "uploading" | "ready" | "failed"
  >("idle");

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const mimeTypeRef = useRef("");
  const enabledRef = useRef(enabled);

  enabledRef.current = enabled;

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

  const attachPreview = useCallback(async (stream: MediaStream) => {
    streamRef.current = stream;
    setCameraActive(true);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});
    }
    const track = stream.getVideoTracks()[0];
    if (track) {
      track.addEventListener("ended", () => {
        setCameraActive(false);
        setCameraWarning(
          "Camera disconnected. Your camera connection was interrupted. Please reconnect your camera.",
        );
        void report("CAMERA_DISCONNECTED", { source: "trackended" });
      });
    }
  }, [report]);

  const start = useCallback(async () => {
    if (!enabledRef.current) return;
    try {
      console.log("[CAMERA] Permission request started");
      const stream = await openCameraStream(deviceId || undefined);
      await attachPreview(stream);
      console.log("[CAMERA] Camera available");

      const mimeType = pickSupportedRecorderMimeType();
      mimeTypeRef.current = mimeType;
      chunksRef.current = [];

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

      if (typeof MediaRecorder === "undefined") {
        setRecordingStatus("failed");
        setCameraWarning("This browser cannot record video.");
        await report("RECORDING_UPLOAD_FAILED", { reason: "no_mediarecorder" });
        return;
      }

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start(2000);
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setRecordingStatus("recording");
      await report("RECORDING_STARTED");
      console.log("[CAMERA] Recording started", { attemptId });
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
    }
  }, [attemptId, attachPreview, deviceId, report]);

  const reconnect = useCallback(async () => {
    setCameraWarning("");
    try {
      const stream = await openCameraStream(deviceId || undefined);
      await attachPreview(stream);
      await report("CAMERA_RECONNECTED");
      // Resume recording on a new MediaRecorder segment if previous stopped.
      if (
        recorderRef.current?.state === "inactive" ||
        !recorderRef.current
      ) {
        const mimeType =
          mimeTypeRef.current || pickSupportedRecorderMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };
        recorder.start(2000);
        recorderRef.current = recorder;
        setRecordingStatus("recording");
      }
    } catch (err) {
      const classified = classifyCameraError(err);
      setCameraWarning(classified.message);
    }
  }, [attachPreview, deviceId, report]);

  /**
   * Stop recorder, upload blob, return success/failure.
   * Call ONLY after successful exam submission.
   */
  const finalizeAfterSubmit = useCallback(async () => {
    setRecordingStatus("stopping");
    const recorder = recorderRef.current;

    const blob = await new Promise<Blob | null>((resolve) => {
      if (!recorder || recorder.state === "inactive") {
        const parts = chunksRef.current;
        resolve(
          parts.length
            ? new Blob(parts, { type: mimeTypeRef.current || "video/webm" })
            : null,
        );
        return;
      }
      recorder.onstop = () => {
        const parts = chunksRef.current;
        resolve(
          parts.length
            ? new Blob(parts, {
                type: recorder.mimeType || mimeTypeRef.current || "video/webm",
              })
            : null,
        );
      };
      try {
        recorder.stop();
      } catch {
        resolve(null);
      }
    });

    const durationSeconds = Math.max(
      0,
      Math.round((Date.now() - (startedAtRef.current || Date.now())) / 1000),
    );

    await report("RECORDING_STOPPED", { durationSeconds });
    console.log("[CAMERA] Recording stopped", { duration: durationSeconds });

    stopMediaStream(streamRef.current);
    streamRef.current = null;
    setCameraActive(false);

    if (!blob || !recordingIdRef.current) {
      setRecordingStatus("failed");
      await markExamRecordingFailedAction({
        attemptId,
        recordingId: recordingIdRef.current || undefined,
        errorMessage: "No recording data",
      });
      await report("RECORDING_UPLOAD_FAILED", { reason: "empty_blob" });
      return { success: false as const };
    }

    setRecordingStatus("uploading");
    const formData = new FormData();
    formData.set("attemptId", attemptId);
    formData.set("recordingId", recordingIdRef.current);
    formData.set("durationSeconds", String(durationSeconds));
    formData.set(
      "file",
      blob,
      `exam-${attemptId}.${blob.type.includes("mp4") ? "mp4" : "webm"}`,
    );

    const uploaded = await uploadExamRecordingAction(formData);
    if (!uploaded.success) {
      setRecordingStatus("failed");
      await report("RECORDING_UPLOAD_FAILED");
      return { success: false as const, error: uploaded.error };
    }
    setRecordingStatus("ready");
    return { success: true as const };
  }, [attemptId, report]);

  useEffect(() => {
    if (!enabled) return;
    void start();
    return () => {
      try {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      } catch {
        // ignore
      }
      stopMediaStream(streamRef.current);
      streamRef.current = null;
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
    finalizeAfterSubmit,
  };
}
