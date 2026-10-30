"use client";

import { useEffect, useRef, useState } from "react";
import { pushEyeGazeCalibrationSample } from "@/lib/face/eye-gaze-calibration";
import { EyeGazeSmoother } from "@/lib/face/eye-gaze-smoothing";
import type { EyeGazeEstimate, EyeGazeTelemetry } from "@/types/eye-gaze";

type Options = {
  enabled: boolean;
  /** Raw same-frame estimate from the head-pose Landmarker sample. */
  estimate: EyeGazeEstimate | null;
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

/**
 * Temporal smoothing + duration telemetry for eye gaze.
 * Does NOT persist SecurityEvents or drive student warnings.
 */
export function useEyeGazeMonitoring({ enabled, estimate }: Options) {
  const [telemetry, setTelemetry] = useState<EyeGazeTelemetry>(emptyTelemetry);
  const smootherRef = useRef<EyeGazeSmoother | null>(null);
  const lastEstimateRef = useRef<EyeGazeEstimate | null>(null);

  useEffect(() => {
    if (!enabled) {
      smootherRef.current?.reset();
      smootherRef.current = null;
      lastEstimateRef.current = null;
      setTelemetry(emptyTelemetry());
      return;
    }
    smootherRef.current ??= new EyeGazeSmoother();
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!estimate) {
      if (lastEstimateRef.current) {
        lastEstimateRef.current = null;
        smootherRef.current?.reset();
        setTelemetry(emptyTelemetry());
      }
      return;
    }

    // Avoid re-processing identical object references from unchanged ticks.
    if (estimate === lastEstimateRef.current) return;
    lastEstimateRef.current = estimate;

    const smoother = smootherRef.current ?? new EyeGazeSmoother();
    smootherRef.current = smoother;
    const next = smoother.push(estimate, Date.now());
    setTelemetry(next);
    pushEyeGazeCalibrationSample(next);

    if (process.env.NODE_ENV === "development") {
      console.log("[EYE-GAZE]", {
        raw: next.rawDirection,
        stable: next.stableDirection,
        confidence: Number(next.confidence.toFixed(2)),
        durationMs: next.durationMs,
        landmarkCount: next.landmarkCount,
        lx: next.leftNormalizedX?.toFixed?.(3) ?? null,
        rx: next.rightNormalizedX?.toFixed?.(3) ?? null,
        fy: next.fusedNormalizedY?.toFixed?.(3) ?? null,
        yaw: next.headYaw != null ? Math.round(next.headYaw) : null,
        pitch: next.headPitch != null ? Math.round(next.headPitch) : null,
        reason: next.reason,
      });
    }
  }, [enabled, estimate]);

  return {
    telemetry,
    /** Convenience aliases for debug panels. */
    stableDirection: telemetry.stableDirection,
    rawDirection: telemetry.rawDirection,
    confidence: telemetry.confidence,
    durationMs: telemetry.durationMs,
  };
}
