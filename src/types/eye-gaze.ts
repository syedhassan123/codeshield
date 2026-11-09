/** Raw / smoothed eye-gaze directions (telemetry only — no warning semantics). */
export const EYE_GAZE_DIRECTIONS = [
  "CENTER",
  "LEFT",
  "RIGHT",
  "DOWN",
  "UNKNOWN",
] as const;

export type EyeGazeDirection = (typeof EYE_GAZE_DIRECTIONS)[number];

/** Per-eye normalized iris geometry in image space (0–1 within the eye box). */
export type EyeGazeEyeGeometry = {
  normalizedX: number | null;
  normalizedY: number | null;
  eyeWidth: number | null;
  eyeHeight: number | null;
  usable: boolean;
};

/**
 * Single-frame geometric gaze estimate.
 * `confidence` is a heuristic in [0, 1], not an ML probability.
 */
export type EyeGazeEstimate = {
  direction: EyeGazeDirection;
  confidence: number;
  landmarkCount: number;
  leftEye: EyeGazeEyeGeometry;
  rightEye: EyeGazeEyeGeometry;
  /** Averaged horizontal ratio when both eyes usable; else usable eye / null. */
  fusedNormalizedX: number | null;
  /** Averaged vertical ratio when both eyes usable; else usable eye / null. */
  fusedNormalizedY: number | null;
  headYaw: number | null;
  headPitch: number | null;
  reason?: string;
};

/** Stable telemetry state after temporal smoothing. */
export type EyeGazeTelemetry = {
  rawDirection: EyeGazeDirection;
  stableDirection: EyeGazeDirection;
  confidence: number;
  durationMs: number;
  landmarkCount: number;
  leftNormalizedX: number | null;
  rightNormalizedX: number | null;
  fusedNormalizedX: number | null;
  fusedNormalizedY: number | null;
  headYaw: number | null;
  headPitch: number | null;
  reason?: string;
  /**
   * Absolute-band direction from the estimator, kept for diagnostics.
   * Warning logic uses `rawDirection`, which is baseline-relative.
   */
  absoluteDirection?: EyeGazeDirection;
  baselineReady?: boolean;
  baselineSampleCount?: number;
  baselineX?: number | null;
  baselineY?: number | null;
  baselineSpreadX?: number | null;
  baselineSpreadY?: number | null;
  deltaX?: number | null;
  deltaY?: number | null;
  /** DEV status: collecting, ready, unavailable, or low confidence. */
  calibrationStatus?: string;
};
