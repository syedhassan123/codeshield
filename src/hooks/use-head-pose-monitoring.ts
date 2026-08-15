"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";
import { FACE_DETECTION_INTERVAL_MS } from "@/lib/face/constants";
import {
  headDebugEventPersisted,
  headDebugMessage,
  headDebugSnapshot,
  headDebugTransition,
  headServerLog,
  resetHeadDebugOrientation,
} from "@/lib/face/head-pose-debug";
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
  /** Face count reported by Phase 8A (exactly one required to run). */
  faceCount: number;
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
  faceCount,
}: Options) {
  const [status, setStatus] = useState<HeadMonitoringStatus>("inactive");
  const [orientation, setOrientation] = useState<HeadOrientation>("NORMAL");
  const [warning, setWarning] = useState("");
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState("");

  const enabledRef = useRef(enabled);
  const cameraActiveRef = useRef(cameraActive);
  const faceCountRef = useRef(faceCount);
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
  const tickRef = useRef<() => Promise<void>>(async () => {});

  enabledRef.current = enabled;
  cameraActiveRef.current = cameraActive;
  faceCountRef.current = faceCount;

  const updateStatus = useCallback((next: HeadMonitoringStatus) => {
    if (statusRef.current === next) return;
    statusRef.current = next;
    setStatus(next);
  }, []);

  const updateOrientation = useCallback((next: HeadOrientation) => {
    const prev = orientationRef.current;
    if (prev === next) return;
    orientationRef.current = next;
    setOrientation(next);
    headDebugTransition(prev, next);
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

      const result = await recordExamSecurityEventAction({
        attemptId,
        eventType,
        metadata,
      });

      if (!result.success) {
        headServerLog(`Failed to persist ${eventType}`, {
          error: "error" in result ? result.error : "unknown",
        });
        return;
      }

      if ("deduped" in result && result.deduped) {
        headServerLog(`${eventType} deduped on server`);
        return;
      }

      headDebugEventPersisted(eventType);
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

  const pauseMonitoring = useCallback(
    (reason: string) => {
      if (episodeStartRef.current != null) {
        const durationMs = Date.now() - episodeStartRef.current;
        headLog("Episode ended", { durationMs, reason });
        resetEpisode();
      }
      updateStatus("paused");
      if (orientationRef.current !== "NORMAL") {
        updateOrientation("NORMAL");
      }
    },
    [resetEpisode, updateOrientation, updateStatus],
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

    const simMode = getHeadPoseSimulationMode();
    const usingSimulation = Boolean(simMode);

    if (!usingSimulation) {
      if (!cameraActiveRef.current) {
        pauseMonitoring("camera_inactive");
        return;
      }
      if (faceCountRef.current !== 1) {
        pauseMonitoring("phase8a_face_count");
        return;
      }
    }

    const video = videoRef.current;
    if (!video) return;

    let sampleOrientation: HeadOrientation = "NORMAL";
    let angles: { yaw: number; pitch: number; roll: number } | null = null;
    let sampleFaceCount = faceCountRef.current;
    let matrixPresent = usingSimulation;

    if (simMode) {
      const sim = simulationToOrientation(simMode);
      if (sim === "NO_FACE" || sim === "MULTIPLE_FACES") {
        pauseMonitoring(sim === "NO_FACE" ? "sim_no_face" : "sim_multiple_faces");
        return;
      }
      sampleOrientation = sim;
      angles = {
        yaw: sim === "RIGHT" ? 35 : sim === "LEFT" ? -35 : 0,
        pitch: sim === "DOWN" ? 35 : sim === "UP" ? -35 : 0,
        roll: 0,
      };
      sampleFaceCount = 1;
    } else {
      const sample = sampleHeadPoseFromVideo(
        landmarkerRef.current,
        video,
        performance.now(),
      );
      if (!sample) return;

      sampleFaceCount = sample.faceCount;
      matrixPresent = sample.angles != null;

      if (sampleFaceCount !== 1) {
        pauseMonitoring("landmarker_face_count");
        return;
      }

      sampleOrientation = sample.orientation;
      angles = sample.angles;
    }

    const now = Date.now();
    const awayDurationMs =
      episodeStartRef.current != null &&
      sampleOrientation !== "NORMAL" &&
      episodeDirectionRef.current === sampleOrientation
        ? now - episodeStartRef.current
        : 0;

    headDebugSnapshot({
      enabled: enabledRef.current,
      cameraActive: cameraActiveRef.current,
      phase8aFaceCount: faceCountRef.current,
      landmarkerFaceCount: sampleFaceCount,
      matrixPresent,
      yaw: angles ? Math.round(angles.yaw) : "n/a",
      pitch: angles ? Math.round(angles.pitch) : "n/a",
      roll: angles ? Math.round(angles.roll) : "n/a",
      orientation: sampleOrientation,
      awayDurationMs,
      warningTriggered: headEventLoggedRef.current,
      prolongedTriggered: prolongedLoggedRef.current,
      simulation: usingSimulation ? simMode : "off",
    });

    updateOrientation(sampleOrientation);

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
      headDebugMessage(`${direction} duration reached 20s`);
      headLog("Looking-away threshold reached", { durationMs, direction });
      await persistEvent(eventType, {
        direction,
        durationMs,
        faceCount: sampleFaceCount,
        phase8aFaceCount: faceCountRef.current,
      });
      qualifyingEpisodesRef.current.push(now);
      await maybeEmitRepeated();
    }

    if (
      durationMs >= HEAD_PROLONGED_THRESHOLD_MS &&
      !prolongedLoggedRef.current
    ) {
      prolongedLoggedRef.current = true;
      headDebugMessage(`${direction} duration reached 30s`);
      headLog("Prolonged looking-away threshold reached", { durationMs, direction });
      await persistEvent("PROLONGED_LOOKING_AWAY", {
        direction,
        durationMs,
        faceCount: sampleFaceCount,
        phase8aFaceCount: faceCountRef.current,
      });
    }
  }, [
    maybeEmitRepeated,
    pauseMonitoring,
    persistEvent,
    resetEpisode,
    updateOrientation,
    updateStatus,
    videoRef,
  ]);

  tickRef.current = tick;

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
    resetHeadDebugOrientation();
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
          cameraActiveRef.current && faceCountRef.current === 1
            ? "active"
            : "paused",
        );

        intervalRef.current = setInterval(() => {
          void tickRef.current();
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
  }, [attemptId, enabled, persistEvent, stop, updateStatus]);

  return {
    status,
    orientation,
    isMonitoring,
    warning,
    error,
  };
}
