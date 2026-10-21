import {
  EYE_GAZE_DOWN_THRESHOLD,
  EYE_GAZE_EXPECTED_LANDMARK_COUNT,
  EYE_GAZE_EXTREME_PITCH_DEG,
  EYE_GAZE_EXTREME_YAW_DEG,
  EYE_GAZE_HORIZONTAL_CENTER_MAX,
  EYE_GAZE_HORIZONTAL_CENTER_MIN,
  EYE_GAZE_MIN_CONFIDENCE,
  EYE_GAZE_SMOOTH_MIN_AGREEMENT,
  EYE_GAZE_SMOOTH_WINDOW,
  EYE_GAZE_SOFT_YAW_DEG,
} from "@/lib/face/eye-gaze-constants";
import type { EyeGazeTelemetry } from "@/types/eye-gaze";

/** Derived-only calibration sample — never stores landmark coordinates. */
export type EyeGazeCalibrationSample = {
  atMs: number;
  rawDirection: string;
  stableDirection: string;
  confidence: number;
  durationMs: number;
  landmarkCount: number;
  fusedNormalizedX: number | null;
  fusedNormalizedY: number | null;
  leftNormalizedX: number | null;
  rightNormalizedX: number | null;
  headYaw: number | null;
  headPitch: number | null;
  reason?: string;
};

const RING_MAX = 120;

type EyeGazeCalibrationApi = {
  last: EyeGazeCalibrationSample | null;
  landmarkCountVerified: number | null;
  samples: EyeGazeCalibrationSample[];
  thresholds: Record<string, number>;
  push: (telemetry: EyeGazeTelemetry) => void;
  summary: () => {
    n: number;
    landmarkCount: number | null;
    fusedX: { min: number; max: number; mean: number } | null;
    fusedY: { min: number; max: number; mean: number } | null;
    unknowns: number;
    stables: Record<string, number>;
  };
  clear: () => void;
};

function ringStats(values: number[]) {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { min, max, mean };
}

function createApi(): EyeGazeCalibrationApi {
  const samples: EyeGazeCalibrationSample[] = [];
  let last: EyeGazeCalibrationSample | null = null;
  let landmarkCountVerified: number | null = null;

  return {
    get last() {
      return last;
    },
    get landmarkCountVerified() {
      return landmarkCountVerified;
    },
    get samples() {
      return samples.slice();
    },
    thresholds: {
      expectedLandmarks: EYE_GAZE_EXPECTED_LANDMARK_COUNT,
      centerMin: EYE_GAZE_HORIZONTAL_CENTER_MIN,
      centerMax: EYE_GAZE_HORIZONTAL_CENTER_MAX,
      downThreshold: EYE_GAZE_DOWN_THRESHOLD,
      minConfidence: EYE_GAZE_MIN_CONFIDENCE,
      softYawDeg: EYE_GAZE_SOFT_YAW_DEG,
      extremeYawDeg: EYE_GAZE_EXTREME_YAW_DEG,
      extremePitchDeg: EYE_GAZE_EXTREME_PITCH_DEG,
      smoothWindow: EYE_GAZE_SMOOTH_WINDOW,
      smoothMinAgreement: EYE_GAZE_SMOOTH_MIN_AGREEMENT,
    },
    push(telemetry) {
      const sample: EyeGazeCalibrationSample = {
        atMs: Date.now(),
        rawDirection: telemetry.rawDirection,
        stableDirection: telemetry.stableDirection,
        confidence: telemetry.confidence,
        durationMs: telemetry.durationMs,
        landmarkCount: telemetry.landmarkCount,
        fusedNormalizedX: telemetry.fusedNormalizedX,
        fusedNormalizedY: telemetry.fusedNormalizedY,
        leftNormalizedX: telemetry.leftNormalizedX,
        rightNormalizedX: telemetry.rightNormalizedX,
        headYaw: telemetry.headYaw,
        headPitch: telemetry.headPitch,
        reason: telemetry.reason,
      };
      last = sample;
      if (telemetry.landmarkCount > 0) {
        landmarkCountVerified = telemetry.landmarkCount;
      }
      samples.push(sample);
      if (samples.length > RING_MAX) samples.shift();
    },
    summary() {
      const fusedX = samples
        .map((s) => s.fusedNormalizedX)
        .filter((v): v is number => v != null && Number.isFinite(v));
      const fusedY = samples
        .map((s) => s.fusedNormalizedY)
        .filter((v): v is number => v != null && Number.isFinite(v));
      const stables: Record<string, number> = {};
      let unknowns = 0;
      for (const s of samples) {
        stables[s.stableDirection] = (stables[s.stableDirection] ?? 0) + 1;
        if (s.rawDirection === "UNKNOWN" || s.stableDirection === "UNKNOWN") {
          unknowns += 1;
        }
      }
      return {
        n: samples.length,
        landmarkCount: landmarkCountVerified,
        fusedX: ringStats(fusedX),
        fusedY: ringStats(fusedY),
        unknowns,
        stables,
      };
    },
    clear() {
      samples.length = 0;
      last = null;
      landmarkCountVerified = null;
    },
  };
}

declare global {
  interface Window {
    __codeshieldEyeGaze?: EyeGazeCalibrationApi;
  }
}

/** Attach / reuse the DEV-only calibration API on window. */
export function ensureEyeGazeCalibrationApi(): EyeGazeCalibrationApi | null {
  if (typeof window === "undefined") return null;
  if (process.env.NODE_ENV === "production") return null;
  window.__codeshieldEyeGaze ??= createApi();
  return window.__codeshieldEyeGaze;
}

export function pushEyeGazeCalibrationSample(telemetry: EyeGazeTelemetry) {
  const api = ensureEyeGazeCalibrationApi();
  api?.push(telemetry);
}
