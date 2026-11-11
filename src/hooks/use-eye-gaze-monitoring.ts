"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";
import {
  classifyGazeAgainstBaseline,
  eyeGazeCalibrationStatusLabel,
  EyeGazeBaselineTracker,
  type EyeGazeBaselineState,
} from "@/lib/face/eye-gaze-baseline";
import {
  bindEyeGazeRecalibrate,
  pushEyeGazeCalibrationSample,
} from "@/lib/face/eye-gaze-calibration";
import {
  EYE_GAZE_EVENT_COOLDOWN_MS,
  EYE_GAZE_EXPECTED_LANDMARK_COUNT,
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
  /** False while the camera is off. A restart reacquires the baseline. */
  cameraActive?: boolean;
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
  baselineReady: false,
  baselineSampleCount: 0,
  baselineX: null,
  baselineY: null,
  baselineSpreadX: null,
  baselineSpreadY: null,
  deltaX: null,
  deltaY: null,
  calibrationStatus: "Tracking unavailable",
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
function withBaseline(
  telemetry: EyeGazeTelemetry,
  baseline: EyeGazeBaselineState,
  deltaX: number | null,
  deltaY: number | null,
  absoluteDirection: EyeGazeTelemetry["absoluteDirection"],
  tracking: boolean,
): EyeGazeTelemetry {
  const lowConfidence = telemetry.reason === "low_confidence";
  return {
    ...telemetry,
    absoluteDirection,
    baselineReady: baseline.ready,
    baselineSampleCount: baseline.sampleCount,
    baselineX: baseline.x,
    baselineY: baseline.y,
    baselineSpreadX: baseline.spreadX,
    baselineSpreadY: baseline.spreadY,
    deltaX,
    deltaY,
    calibrationStatus: eyeGazeCalibrationStatusLabel({
      tracking,
      baselineReady: baseline.ready,
      lowConfidence,
    }),
  };
}

export function useEyeGazeMonitoring({
  enabled,
  estimate,
  attemptId,
  headOrientation,
  cameraActive = true,
}: Options) {
  const [telemetry, setTelemetry] = useState<EyeGazeTelemetry>(emptyTelemetry);
  const [warning, setWarning] = useState<EyeGazeWarningState>(emptyWarning);
  const smootherRef = useRef<EyeGazeSmoother | null>(null);
  const baselineRef = useRef(new EyeGazeBaselineTracker());
  const lastEstimateRef = useRef<EyeGazeEstimate | null>(null);
  const warningLoggedRef = useRef(false);
  const prolongedLoggedRef = useRef(false);
  const episodeDirRef = useRef<string | null>(null);
  const lastPersistRef = useRef(0);
  const headOrientationRef = useRef<HeadOrientation | undefined>(
    headOrientation,
  );
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
    if (process.env.NODE_ENV === "production") return;
    bindEyeGazeRecalibrate(() => {
      baselineRef.current.reset();
      smootherRef.current?.reset();
      lastEstimateRef.current = null;
      resetEpisodeFlags();
      setTelemetry(emptyTelemetry());
      setWarning(emptyWarning());
    });
    return () => bindEyeGazeRecalibrate(null);
  }, [resetEpisodeFlags]);

  useEffect(() => {
    // Camera off, exam end, or monitoring disabled: drop the baseline.
    // A later camera restart acquires a new one (position may have changed).
    if (!enabled || !cameraActive) {
      baselineRef.current.reset();
      smootherRef.current?.reset();
      smootherRef.current = null;
      lastEstimateRef.current = null;
      resetEpisodeFlags();
      setTelemetry(emptyTelemetry());
      setWarning(emptyWarning());
      return;
    }
    smootherRef.current ??= new EyeGazeSmoother();
  }, [enabled, cameraActive, resetEpisodeFlags]);

  useEffect(() => {
    if (!enabled || !cameraActive) return;
    if (!estimate) {
      // Face loss: stop the eye episode, keep the locked baseline.
      if (lastEstimateRef.current) {
        lastEstimateRef.current = null;
        smootherRef.current?.reset();
        resetEpisodeFlags();
        const retained = baselineRef.current.state;
        setTelemetry(
          withBaseline(
            {
              ...emptyTelemetry(),
              reason: "face_unavailable",
            },
            retained,
            null,
            null,
            undefined,
            false,
          ),
        );
        setWarning(emptyWarning());
      }
      return;
    }

    if (estimate === lastEstimateRef.current) return;
    lastEstimateRef.current = estimate;

    const baseline = baselineRef.current.consider(
      estimate,
      headOrientationRef.current,
    );
    const classified = classifyGazeAgainstBaseline(estimate, baseline);

    const smoother = smootherRef.current ?? new EyeGazeSmoother();
    smootherRef.current = smoother;
    const smoothed = smoother.push(classified.estimate, Date.now());
    const next = withBaseline(
      smoothed,
      baseline,
      classified.deltaX,
      classified.deltaY,
      estimate.direction,
      estimate.landmarkCount === EYE_GAZE_EXPECTED_LANDMARK_COUNT &&
        estimate.fusedNormalizedX != null &&
        estimate.reason !== "eyes_unusable" &&
        estimate.reason !== "missing_fused_ratio" &&
        estimate.reason !== "eyes_disagree" &&
        estimate.reason !== "extreme_head_pose" &&
        !estimate.reason?.startsWith("landmark_count"),
    );
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
        baselineReady: next.baselineReady,
        deltaX: next.deltaX,
        deltaY: next.deltaY,
        calibrationStatus: next.calibrationStatus,
      });
    }
  }, [enabled, cameraActive, estimate, persistEvent, resetEpisodeFlags]);

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
