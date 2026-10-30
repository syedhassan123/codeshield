import {
  EYE_GAZE_MIN_CONFIDENCE,
  EYE_GAZE_PROLONGED_THRESHOLD_MS,
  EYE_GAZE_WARNING_THRESHOLD_MS,
} from "@/lib/face/eye-gaze-constants";
import type { EyeGazeDirection } from "@/types/eye-gaze";

/** Stable directions that may accumulate an eye-away episode. */
export const EYE_GAZE_AWAY_DIRECTIONS = ["LEFT", "RIGHT", "DOWN"] as const;

export type EyeGazeAwayDirection = (typeof EYE_GAZE_AWAY_DIRECTIONS)[number];

export type EyeGazeWarningTier = 0 | 1 | 2;

export type EyeGazeWarningState = {
  /** Stable away with sufficient confidence (episode running; may be under 5s). */
  away: boolean;
  /** Warning overlay should appear (tier ≥ 1). */
  active: boolean;
  tier: EyeGazeWarningTier;
  direction: EyeGazeAwayDirection | null;
  durationMs: number;
  confidence: number;
};

export function isEyeAwayDirection(
  direction: EyeGazeDirection,
): direction is EyeGazeAwayDirection {
  return (
    direction === "LEFT" || direction === "RIGHT" || direction === "DOWN"
  );
}

/**
 * Independent eye-away warning from smoothed gaze only.
 *
 * CENTER → no warning, episode duration ignored.
 * UNKNOWN or confidence below EYE_GAZE_MIN_CONFIDENCE → pause/reset
 *   (does not accumulate through low-confidence gaps).
 * LEFT / RIGHT / DOWN → duration is the current stable-direction episode.
 * Direction change (e.g. LEFT → RIGHT) is a new episode because the smoother
 * resets durationMs when stableDirection changes.
 *
 * DOWN is treated the same as LEFT/RIGHT (not more aggressive). Webcam
 * calibration may later distinguish keyboard vs. lower-screen reading.
 */
export function computeEyeGazeWarningState(input: {
  stableDirection: EyeGazeDirection;
  durationMs: number;
  confidence: number;
}): EyeGazeWarningState {
  const confidence = Number.isFinite(input.confidence) ? input.confidence : 0;
  const confOk = confidence >= EYE_GAZE_MIN_CONFIDENCE;
  const direction = input.stableDirection;
  const away = confOk && isEyeAwayDirection(direction);

  if (!away || !isEyeAwayDirection(direction)) {
    return {
      away: false,
      active: false,
      tier: 0,
      direction: null,
      durationMs: 0,
      confidence,
    };
  }

  const durationMs = Math.max(0, input.durationMs);
  let tier: EyeGazeWarningTier = 0;
  if (durationMs >= EYE_GAZE_PROLONGED_THRESHOLD_MS) tier = 2;
  else if (durationMs >= EYE_GAZE_WARNING_THRESHOLD_MS) tier = 1;

  return {
    away: true,
    active: tier >= 1,
    tier,
    direction,
    durationMs,
    confidence,
  };
}
