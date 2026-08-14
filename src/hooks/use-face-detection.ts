"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";
import {
  FACE_DETECTION_INTERVAL_MS,
  FACE_EVENT_COOLDOWN_MS,
  FACE_MULTIPLE_THRESHOLD_MS,
  FACE_NO_FACE_THRESHOLD_MS,
} from "@/lib/face/constants";
import {
  countFacesInVideo,
  getFaceDetector,
  releaseFaceDetector,
} from "@/lib/face/detector";

export type FaceMonitoringStatus =
  | "inactive"
  | "preparing"
  | "active"
  | "detected"
  | "not_detected"
  | "multiple"
  | "paused"
  | "unavailable";

type Options = {
  attemptId: string;
  enabled: boolean;
  /** Existing exam preview element — must already have the camera stream attached. */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** False while camera is disconnected/unavailable — pauses face observations. */
  cameraActive: boolean;
};

type ViolationEpisode = "none" | "no_face" | "multiple_faces";

function faceLog(message: string, extra?: Record<string, unknown>) {
  if (extra) {
    console.log("[FACE]", message, extra);
    return;
  }
  console.log("[FACE]", message);
}

/**
 * Real-time face presence monitoring on the existing exam camera preview.
 * Persists structured observation events only on sustained state changes.
 */
export function useFaceDetection({
  attemptId,
  enabled,
  videoRef,
  cameraActive,
}: Options) {
  const [status, setStatus] = useState<FaceMonitoringStatus>("inactive");
  const [faceCount, setFaceCount] = useState(0);
  const [warning, setWarning] = useState("");
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState("");

  const enabledRef = useRef(enabled);
  const cameraActiveRef = useRef(cameraActive);
  const faceCountRef = useRef(0);
  const statusRef = useRef<FaceMonitoringStatus>("inactive");
  const episodeRef = useRef<ViolationEpisode>("none");
  const noFaceSinceRef = useRef<number | null>(null);
  const multipleSinceRef = useRef<number | null>(null);
  const lastPersistRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const detectorRef = useRef<Awaited<ReturnType<typeof getFaceDetector>> | null>(
    null,
  );
  const startedRef = useRef(false);

  enabledRef.current = enabled;
  cameraActiveRef.current = cameraActive;

  const updateStatus = useCallback((next: FaceMonitoringStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
  }, []);

  const updateFaceCount = useCallback((count: number) => {
    if (faceCountRef.current === count) return;
    faceCountRef.current = count;
    setFaceCount(count);
  }, []);

  const persistEvent = useCallback(
    async (
      eventType:
        | "FACE_DETECTED"
        | "NO_FACE_DETECTED"
        | "MULTIPLE_FACES_DETECTED"
        | "FACE_DETECTION_UNAVAILABLE",
      metadata: Record<string, unknown>,
    ) => {
      const now = Date.now();
      if (now - lastPersistRef.current < FACE_EVENT_COOLDOWN_MS) {
        return;
      }
      lastPersistRef.current = now;
      await recordExamSecurityEventAction({
        attemptId,
        eventType,
        metadata,
      });
    },
    [attemptId],
  );

  const resetEpisodeTimers = useCallback(() => {
    noFaceSinceRef.current = null;
    multipleSinceRef.current = null;
  }, []);

  const applyNormalState = useCallback(
    (count: number, recoveredFrom?: ViolationEpisode) => {
      episodeRef.current = "none";
      resetEpisodeTimers();
      setWarning("");
      updateFaceCount(count);
      updateStatus("detected");

      if (recoveredFrom && recoveredFrom !== "none") {
        void persistEvent("FACE_DETECTED", {
          faceCount: count,
          recoveredFrom,
        });
        faceLog("Face recovered", { faceCount: count, recoveredFrom });
      }
    },
    [persistEvent, resetEpisodeTimers, updateFaceCount, updateStatus],
  );

  const tick = useCallback(async () => {
    if (!enabledRef.current || !detectorRef.current) return;

    if (!cameraActiveRef.current) {
      updateStatus("paused");
      setWarning("");
      resetEpisodeTimers();
      episodeRef.current = "none";
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const count = countFacesInVideo(
      detectorRef.current,
      video,
      performance.now(),
    );
    if (count < 0) return;

    faceLog("Detection", { faceCount: count });
    updateFaceCount(count);

    const now = Date.now();

    if (count === 1) {
      const recoveredFrom = episodeRef.current;
      applyNormalState(count, recoveredFrom !== "none" ? recoveredFrom : undefined);
      return;
    }

    if (count === 0) {
      multipleSinceRef.current = null;
      if (noFaceSinceRef.current == null) {
        noFaceSinceRef.current = now;
      }
      const durationMs = now - noFaceSinceRef.current;

      if (
        durationMs >= FACE_NO_FACE_THRESHOLD_MS &&
        episodeRef.current !== "no_face"
      ) {
        episodeRef.current = "no_face";
        updateStatus("not_detected");
        setWarning(
          "Face not detected. Please remain visible to the camera.",
        );
        faceLog("No face threshold reached", { durationMs });
        void persistEvent("NO_FACE_DETECTED", { faceCount: 0, durationMs });
      } else if (episodeRef.current !== "no_face") {
        updateStatus("active");
      }
      return;
    }

    // count > 1
    noFaceSinceRef.current = null;
    if (multipleSinceRef.current == null) {
      multipleSinceRef.current = now;
    }
    const durationMs = now - multipleSinceRef.current;

    if (
      durationMs >= FACE_MULTIPLE_THRESHOLD_MS &&
      episodeRef.current !== "multiple_faces"
    ) {
      episodeRef.current = "multiple_faces";
      updateStatus("multiple");
      setWarning(
        "Multiple faces detected. Please ensure only the exam candidate is visible.",
      );
      faceLog("Multiple face threshold reached", { faceCount: count, durationMs });
      void persistEvent("MULTIPLE_FACES_DETECTED", { faceCount: count, durationMs });
    } else if (episodeRef.current !== "multiple_faces") {
      updateStatus("active");
    }
  }, [
    applyNormalState,
    persistEvent,
    resetEpisodeTimers,
    updateFaceCount,
    updateStatus,
    videoRef,
  ]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    detectorRef.current = null;
    setIsDetecting(false);
    updateStatus("inactive");
    setWarning("");
    setError("");
    resetEpisodeTimers();
    episodeRef.current = "none";
    if (startedRef.current) {
      faceLog("Detector stopped", { attemptId });
      startedRef.current = false;
      void releaseFaceDetector();
    }
  }, [attemptId, resetEpisodeTimers, updateStatus]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let cancelled = false;

    const start = async () => {
      faceLog("Detector initializing", { attemptId });
      updateStatus("preparing");
      setError("");
      setIsDetecting(true);

      try {
        const detector = await getFaceDetector();
        if (cancelled || !enabledRef.current) return;
        detectorRef.current = detector;
        startedRef.current = true;
        faceLog("Detector ready");
        updateStatus(cameraActiveRef.current ? "active" : "paused");

        intervalRef.current = setInterval(() => {
          void tick();
        }, FACE_DETECTION_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Face monitoring could not be initialized.";
        setError(message);
        updateStatus("unavailable");
        setIsDetecting(false);
        faceLog("Detector init failed", { message });
        void persistEvent("FACE_DETECTION_UNAVAILABLE", {
          reason: "model_load_failed",
          message,
        });
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [attemptId, enabled, persistEvent, stop, tick, updateStatus]);

  return {
    status,
    faceCount,
    isDetecting,
    warning,
    error,
  };
}

export { releaseFaceDetector };
