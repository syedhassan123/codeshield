"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";
import { pushEyeGazeCalibrationSample } from "@/lib/face/eye-gaze-calibration";
import {
  EYE_GAZE_EVENT_COOLDOWN_MS,
} from "@/lib/face/eye-gaze-constants";
import { EyeGazeSmoother } from "@/lib/face/eye-gaze-smoothing";
import {
  computeEyeGazeWarningState,
  type EyeGazeWarningState,
} from "@/lib/face/eye-gaze-warning";
import type { HeadOrientation } from "@/lib/face/head-pose-orientation";
import type { EyeGazeEstimate, EyeGazeTelemetry } from "@/types/eye-gaze";

type Options = {
  enabled: boolean;
  /** Raw same-frame estimate from the head-pose Landmarker sample. */
  estimate: EyeGazeEstimate | null;
  attemptId?: string;
  headOrientation?: HeadOrientation;
};

const emptyTelemetry = (): EyeGazeTelemetry => ({
  rawDirection: "UNKNOWN",
  stableDirection: "UNKNOWN",
  confidence: 0,
  durationMs: 0,
  landmarkCount: 0,
  leftNormalizedX: null,
  rightNormalizedX: null,
  fusedNormalizedX: null,
  fusedNormalizedY: null,
  headYaw: null,
  headPitch: null,
  reason: "inactive",
});

const emptyWarning = (): EyeGazeWarningState => ({
  away: false,
  active: false,
  tier: 0,
  direction: null,
  durationMs: 0,
  confidence: 0,
});

/**
 * Temporal smoothing + independent eye-away warning + threshold SecurityEvents.
 * Does not drive or mutate head-pose warning timers.
 */
export function useEyeGazeMonitoring({
  enabled,
  estimate,
  attemptId,
  headOrientation,
}: Options) {
  const [telemetry, setTelemetry] = useState<EyeGazeTelemetry>(emptyTelemetry);
  const [warning, setWarning] = useState<EyeGazeWarningState>(emptyWarning);
  const smootherRef = useRef<EyeGazeSmoother | null>(null);
  const lastEstimateRef = useRef<EyeGazeEstimate | null>(null);
  const warningLoggedRef = useRef(false);
  const prolongedLoggedRef = useRef(false);
  const episodeDirRef = useRef<string | null>(null);
  const lastPersistRef = useRef(0);
  const headOrientationRef = useRef<HeadOrientation | undefined>(headOrientation);
  const attemptIdRef = useRef(attemptId);

  headOrientationRef.current = headOrientation;
  attemptIdRef.current = attemptId;

  const persistEvent = useCallback(
    async (
      eventType: "EYE_GAZE_AWAY" | "EYE_GAZE_AWAY_PROLONGED",
      metadata: Record<string, unknown>,
    ) => {
      const id = attemptIdRef.current;
      if (!id) return;

      const now = Date.now();
      if (
        eventType !== "EYE_GAZE_AWAY_PROLONGED" &&
        now - lastPersistRef.current < EYE_GAZE_EVENT_COOLDOWN_MS
      ) {
        return;
      }
      lastPersistRef.current = now;

      const result = await recordExamSecurityEventAction({
        attemptId: id,
        eventType,
        metadata,
      });

      if (!result.success && process.env.NODE_ENV === "development") {
        console.log("[EYE-GAZE] persist failed", eventType);
      }
    },
    [],
  );

  const resetEpisodeFlags = useCallback(() => {
    warningLoggedRef.current = false;
    prolongedLoggedRef.current = false;
    episodeDirRef.current = null;
  }, []);

  useEffect(() => {
    if (!enabled) {
      smootherRef.current?.reset();
      smootherRef.current = null;
      lastEstimateRef.current = null;
      resetEpisodeFlags();
      setTelemetry(emptyTelemetry());
      setWarning(emptyWarning());
      return;
    }
    smootherRef.current ??= new EyeGazeSmoother();
  }, [enabled, resetEpisodeFlags]);

  useEffect(() => {
    if (!enabled) return;
    if (!estimate) {
      if (lastEstimateRef.current) {
        lastEstimateRef.current = null;
        smootherRef.current?.reset();
        resetEpisodeFlags();
        setTelemetry(emptyTelemetry());
        setWarning(emptyWarning());
      }
      return;
    }

    if (estimate === lastEstimateRef.current) return;
    lastEstimateRef.current = estimate;

    const smoother = smootherRef.current ?? new EyeGazeSmoother();
    smootherRef.current = smoother;
    const next = smoother.push(estimate, Date.now());
    const nextWarning = computeEyeGazeWarningState({
      stableDirection: next.stableDirection,
      durationMs: next.durationMs,
      confidence: next.confidence,
    });

    setTelemetry(next);
    setWarning(nextWarning);
    pushEyeGazeCalibrationSample(next);

    if (!nextWarning.away) {
      resetEpisodeFlags();
    } else {
      if (episodeDirRef.current !== nextWarning.direction) {
        warningLoggedRef.current = false;
        prolongedLoggedRef.current = false;
        episodeDirRef.current = nextWarning.direction;
      }

      const meta = {
        direction: nextWarning.direction,
        durationMs: nextWarning.durationMs,
        confidence: Number(nextWarning.confidence.toFixed(3)),
        headOrientation: headOrientationRef.current ?? null,
        headYaw: next.headYaw,
        headPitch: next.headPitch,
      };

      if (nextWarning.tier >= 1 && !warningLoggedRef.current) {
        warningLoggedRef.current = true;
        void persistEvent("EYE_GAZE_AWAY", meta);
      }
      if (nextWarning.tier >= 2 && !prolongedLoggedRef.current) {
        prolongedLoggedRef.current = true;
        void persistEvent("EYE_GAZE_AWAY_PROLONGED", meta);
      }
    }

    if (process.env.NODE_ENV === "development") {
      console.log("[EYE-GAZE]", {
        raw: next.rawDirection,
        stable: next.stableDirection,
        confidence: Number(next.confidence.toFixed(2)),
        durationMs: next.durationMs,
        warningTier: nextWarning.tier,
        landmarkCount: next.landmarkCount,
        lx: next.leftNormalizedX?.toFixed?.(3) ?? null,
        rx: next.rightNormalizedX?.toFixed?.(3) ?? null,
        fy: next.fusedNormalizedY?.toFixed?.(3) ?? null,
        yaw: next.headYaw != null ? Math.round(next.headYaw) : null,
        pitch: next.headPitch != null ? Math.round(next.headPitch) : null,
        reason: next.reason,
      });
    }
  }, [enabled, estimate, persistEvent, resetEpisodeFlags]);

  return {
    telemetry,
    warning,
    stableDirection: telemetry.stableDirection,
    rawDirection: telemetry.rawDirection,
    confidence: telemetry.confidence,
    durationMs: telemetry.durationMs,
    warningTier: warning.tier,
    eyeWarning: warning.active,
  };
}
