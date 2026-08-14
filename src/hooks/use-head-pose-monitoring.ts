"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";
import { FACE_DETECTION_INTERVAL_MS } from "@/lib/face/constants";
import {
  getFaceLandmarker,
  releaseFaceLandmarker,
  sampleHeadPoseFromVideo,
} from "@/lib/face/head-pose-detector";
import {
  HEAD_EVENT_COOLDOWN_MS,
  HEAD_PROLONGED_THRESHOLD_MS,
  HEAD_REPEATED_EPISODE_COUNT,
  HEAD_REPEATED_WINDOW_MS,
  HEAD_WARNING_THRESHOLD_MS,
} from "@/lib/face/head-pose-constants";
import {
  orientationToEventType,
  type HeadOrientation,
} from "@/lib/face/head-pose-orientation";
import {
  attachHeadPoseSimulationToWindow,
  getHeadPoseSimulationMode,
  simulationToOrientation,
} from "@/lib/face/head-pose-simulation";

export type HeadMonitoringStatus =
  | "inactive"
  | "preparing"
  | "active"
  | "looking_away"
  | "paused"
  | "unavailable";

type Options = {
  attemptId: string;
  enabled: boolean;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraActive: boolean;
  /** True when Phase 8A reports exactly one visible face. */
  faceReady: boolean;
};

type LookingDirection = Exclude<HeadOrientation, "NORMAL">;

function headLog(message: string, extra?: Record<string, unknown>) {
  if (extra) {
    console.log("[HEAD]", message, extra);
    return;
  }
  console.log("[HEAD]", message);
}

export function useHeadPoseMonitoring({
  attemptId,
  enabled,
  videoRef,
  cameraActive,
  faceReady,
}: Options) {
  const [status, setStatus] = useState<HeadMonitoringStatus>("inactive");
  const [orientation, setOrientation] = useState<HeadOrientation>("NORMAL");
  const [warning, setWarning] = useState("");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState("");

  const enabledRef = useRef(enabled);
  const cameraActiveRef = useRef(cameraActive);
  const faceReadyRef = useRef(faceReady);
  const statusRef = useRef<HeadMonitoringStatus>("inactive");
  const orientationRef = useRef<HeadOrientation>("NORMAL");
  const episodeStartRef = useRef<number | null>(null);
  const episodeDirectionRef = useRef<LookingDirection | null>(null);
  const headEventLoggedRef = useRef(false);
  const prolongedLoggedRef = useRef(false);
  const repeatedBurstRef = useRef(false);
  const qualifyingEpisodesRef = useRef<number[]>([]);
  const lastPersistRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const landmarkerRef = useRef<Awaited<ReturnType<typeof getFaceLandmarker>> | null>(
    null,
  );
  const startedRef = useRef(false);

  enabledRef.current = enabled;
  cameraActiveRef.current = cameraActive;
  faceReadyRef.current = faceReady;

  const updateStatus = useCallback((next: HeadMonitoringStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
  }, []);

  const updateOrientation = useCallback((next: HeadOrientation) => {
    if (orientationRef.current === next) return;
    orientationRef.current = next;
    setOrientation(next);
  }, []);

  const persistEvent = useCallback(
    async (
      eventType:
        | "HEAD_LOOKING_LEFT"
        | "HEAD_LOOKING_RIGHT"
        | "HEAD_LOOKING_UP"
        | "HEAD_LOOKING_DOWN"
        | "PROLONGED_LOOKING_AWAY"
        | "REPEATED_LOOKING_AWAY"
        | "HEAD_MONITORING_UNAVAILABLE",
      metadata: Record<string, unknown>,
    ) => {
      const now = Date.now();
      if (
        eventType !== "REPEATED_LOOKING_AWAY" &&
        now - lastPersistRef.current < HEAD_EVENT_COOLDOWN_MS
      ) {
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

  const resetEpisode = useCallback(
    (endedDurationMs?: number) => {
      if (episodeStartRef.current != null && endedDurationMs != null) {
        headLog("Episode ended", { durationMs: endedDurationMs });
      }

      episodeStartRef.current = null;
      episodeDirectionRef.current = null;
      headEventLoggedRef.current = false;
      prolongedLoggedRef.current = false;
      setWarning("");
      updateStatus("active");
    },
    [updateStatus],
  );

  const pruneQualifyingEpisodes = useCallback(() => {
    const cutoff = Date.now() - HEAD_REPEATED_WINDOW_MS;
    qualifyingEpisodesRef.current = qualifyingEpisodesRef.current.filter(
      (ts) => ts >= cutoff,
    );
  }, []);

  const maybeEmitRepeated = useCallback(async () => {
    pruneQualifyingEpisodes();
    const count = qualifyingEpisodesRef.current.length;
    if (
      count >= HEAD_REPEATED_EPISODE_COUNT &&
      !repeatedBurstRef.current
    ) {
      repeatedBurstRef.current = true;
      headLog("Repeated looking-away threshold reached", { episodeCount: count });
      setWarning("⚠️ Please remain focused on the screen during the exam.");
      await persistEvent("REPEATED_LOOKING_AWAY", {
        episodeCount: count,
        windowMs: HEAD_REPEATED_WINDOW_MS,
      });
    }
    if (count < HEAD_REPEATED_EPISODE_COUNT) {
      repeatedBurstRef.current = false;
    }
  }, [persistEvent, pruneQualifyingEpisodes]);

  const tick = useCallback(async () => {
    if (!enabledRef.current || !landmarkerRef.current) return;

    if (!cameraActiveRef.current || !faceReadyRef.current) {
      if (episodeStartRef.current != null) {
        const durationMs = Date.now() - episodeStartRef.current;
        headLog("Episode ended", { durationMs, reason: "face_or_camera_pause" });
        resetEpisode();
      }
      updateStatus("paused");
      updateOrientation("NORMAL");
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    let sampleOrientation: HeadOrientation = "NORMAL";
    let angles: { yaw: number; pitch: number; roll: number } | null = null;
    let sampleFaceCount = 1;

    const simMode = getHeadPoseSimulationMode();
    if (simMode) {
      const sim = simulationToOrientation(simMode);
      if (sim === "NO_FACE" || sim === "MULTIPLE_FACES") {
        if (episodeStartRef.current != null) {
          resetEpisode();
        }
        updateStatus("paused");
        updateOrientation("NORMAL");
        return;
      }
      sampleOrientation = sim;
      angles = {
        yaw: sim === "RIGHT" ? 35 : sim === "LEFT" ? -35 : 0,
        pitch: sim === "DOWN" ? 35 : sim === "UP" ? -35 : 0,
        roll: 0,
      };
    } else {
      const sample = sampleHeadPoseFromVideo(
        landmarkerRef.current,
        video,
        performance.now(),
      );
      if (!sample) return;
      sampleFaceCount = sample.faceCount;
      if (sampleFaceCount !== 1) {
        if (episodeStartRef.current != null) {
          resetEpisode();
        }
        updateStatus("paused");
        updateOrientation("NORMAL");
        return;
      }
      sampleOrientation = sample.orientation;
      angles = sample.angles;
    }

    if (angles) {
      headLog(`Orientation=${sampleOrientation}`, {
        yaw: Math.round(angles.yaw),
        pitch: Math.round(angles.pitch),
        roll: Math.round(angles.roll),
      });
    }

    updateOrientation(sampleOrientation);
    const now = Date.now();

    if (sampleOrientation === "NORMAL") {
      if (episodeStartRef.current != null) {
        const durationMs = now - episodeStartRef.current;
        headLog("Episode ended", { durationMs });
        resetEpisode(durationMs);
      } else {
        updateStatus("active");
        setWarning("");
      }
      return;
    }

    const direction = sampleOrientation as LookingDirection;

    if (
      episodeStartRef.current == null ||
      episodeDirectionRef.current !== direction
    ) {
      episodeStartRef.current = now;
      episodeDirectionRef.current = direction;
      headEventLoggedRef.current = false;
      prolongedLoggedRef.current = false;
    }

    const durationMs = now - episodeStartRef.current;
    updateStatus("looking_away");

    if (
      durationMs >= HEAD_WARNING_THRESHOLD_MS &&
      !headEventLoggedRef.current
    ) {
      headEventLoggedRef.current = true;
      const eventType = orientationToEventType(direction);
      setWarning("⚠️ Please look at the screen to continue your exam.");
      headLog("Looking-away threshold reached", { durationMs, direction });
      await persistEvent(eventType, {
        direction,
        durationMs,
        faceCount: sampleFaceCount,
      });
      qualifyingEpisodesRef.current.push(now);
      await maybeEmitRepeated();
    } else if (
      durationMs >= HEAD_PROLONGED_THRESHOLD_MS &&
      !prolongedLoggedRef.current
    ) {
      prolongedLoggedRef.current = true;
      headLog("Prolonged looking-away threshold reached", { durationMs, direction });
      await persistEvent("PROLONGED_LOOKING_AWAY", {
        direction,
        durationMs,
        faceCount: sampleFaceCount,
      });
    }
  }, [
    maybeEmitRepeated,
    persistEvent,
    resetEpisode,
    updateOrientation,
    updateStatus,
    videoRef,
  ]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    landmarkerRef.current = null;
    setIsMonitoring(false);
    updateStatus("inactive");
    setWarning("");
    setError("");
    episodeStartRef.current = null;
    episodeDirectionRef.current = null;
    headEventLoggedRef.current = false;
    prolongedLoggedRef.current = false;
    qualifyingEpisodesRef.current = [];
    repeatedBurstRef.current = false;
    if (startedRef.current) {
      headLog("Monitoring stopped", { attemptId });
      startedRef.current = false;
      void releaseFaceLandmarker();
    }
  }, [attemptId, updateStatus]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    attachHeadPoseSimulationToWindow();
    let cancelled = false;

    const start = async () => {
      headLog("Monitoring initialized", { attemptId });
      updateStatus("preparing");
      setError("");
      setIsMonitoring(true);

      try {
        const landmarker = await getFaceLandmarker();
        if (cancelled || !enabledRef.current) return;
        landmarkerRef.current = landmarker;
        startedRef.current = true;
        updateStatus(
          cameraActiveRef.current && faceReadyRef.current ? "active" : "paused",
        );

        intervalRef.current = setInterval(() => {
          void tick();
        }, FACE_DETECTION_INTERVAL_MS);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : "Head monitoring could not be initialized.";
        setError(message);
        updateStatus("unavailable");
        setIsMonitoring(false);
        headLog("Monitoring init failed", { message });
        await persistEvent("HEAD_MONITORING_UNAVAILABLE", {
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
    orientation,
    isMonitoring,
    warning,
    error,
  };
}
