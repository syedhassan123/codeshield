import {
  EYE_GAZE_BASELINE_MAX_ABS_PITCH_DEG,
  EYE_GAZE_BASELINE_MAX_ABS_YAW_DEG,
  EYE_GAZE_BASELINE_MAX_X_SPREAD,
  EYE_GAZE_BASELINE_MAX_Y_SPREAD,
  EYE_GAZE_BASELINE_MIN_SAMPLES,
  EYE_GAZE_BASELINE_WINDOW,
  EYE_GAZE_DOWN_DELTA_THRESHOLD,
  EYE_GAZE_EXPECTED_LANDMARK_COUNT,
  EYE_GAZE_LEFT_DELTA_THRESHOLD,
  EYE_GAZE_MIN_CONFIDENCE,
  EYE_GAZE_RIGHT_DELTA_THRESHOLD,
} from "@/lib/face/eye-gaze-constants";
import type { EyeGazeDirection, EyeGazeEstimate } from "@/types/eye-gaze";

/**
 * Per-session neutral gaze baseline.
 *
 * Browser memory only. Never written to MongoDB, SecurityEvents, or disk.
 * Once locked, the baseline does not move while the student looks away.
 *
 * Face loss keeps the baseline (do not rebuild it from the first noisy frame).
 * Camera stop, monitoring disable, unmount, and DEV recalibrate call reset(),
 * which drops the baseline so the next camera session acquires a new one.
 */

export type EyeGazeBaselineState = {
  ready: boolean;
  x: number | null;
  y: number | null;
  sampleCount: number;
  confidence: number;
  spreadX: number;
  spreadY: number;
};

export type ClassifiedEyeGaze = {
  estimate: EyeGazeEstimate;
  deltaX: number | null;
  deltaY: number | null;
};

type NeutralSample = {
  x: number;
  y: number;
  confidence: number;
};

const emptyState = (): EyeGazeBaselineState => ({
  ready: false,
  x: null,
  y: null,
  sampleCount: 0,
  confidence: 0,
  spreadX: 0,
  spreadY: 0,
});

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1]! + sorted[mid]!) / 2;
  }
  return sorted[mid]!;
}

function spread(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.max(...values) - Math.min(...values);
}

/**
 * A frame may join the neutral window only when the head is straight,
 * both eyes have usable geometry, and confidence clears the existing minimum.
 * Absolute LEFT/RIGHT/CENTER is intentionally ignored: the student's own
 * neutral iris position is what we are measuring.
 */
export function isNeutralBaselineSample(
  estimate: EyeGazeEstimate,
  headOrientation: string | undefined,
): boolean {
  if (estimate.landmarkCount !== EYE_GAZE_EXPECTED_LANDMARK_COUNT) return false;
  if (estimate.reason) return false;
  if (estimate.confidence < EYE_GAZE_MIN_CONFIDENCE) return false;
  if (headOrientation !== "NORMAL") return false;
  if (estimate.headYaw == null || estimate.headPitch == null) return false;
  if (Math.abs(estimate.headYaw) > EYE_GAZE_BASELINE_MAX_ABS_YAW_DEG) return false;
  if (Math.abs(estimate.headPitch) > EYE_GAZE_BASELINE_MAX_ABS_PITCH_DEG) {
    return false;
  }
  if (!estimate.leftEye.usable || !estimate.rightEye.usable) return false;
  const x = estimate.fusedNormalizedX;
  const y = estimate.fusedNormalizedY;
  return x != null && y != null && Number.isFinite(x) && Number.isFinite(y);
}

export class EyeGazeBaselineTracker {
  private window: NeutralSample[] = [];
  private locked: EyeGazeBaselineState | null = null;

  reset(): void {
    this.window = [];
    this.locked = null;
  }

  get state(): EyeGazeBaselineState {
    if (this.locked) return this.locked;
    return this.pendingState();
  }

  /**
   * Offer one frame. Ignored after the baseline locks, so a sustained look
   * away cannot become the new center.
   */
  consider(
    estimate: EyeGazeEstimate,
    headOrientation: string | undefined,
  ): EyeGazeBaselineState {
    if (this.locked) return this.locked;
    if (!isNeutralBaselineSample(estimate, headOrientation)) {
      return this.pendingState();
    }

    this.window.push({
      x: estimate.fusedNormalizedX as number,
      y: estimate.fusedNormalizedY as number,
      confidence: estimate.confidence,
    });
    if (this.window.length > EYE_GAZE_BASELINE_WINDOW) {
      this.window.shift();
    }

    if (this.window.length >= EYE_GAZE_BASELINE_MIN_SAMPLES) {
      const xs = this.window.map((s) => s.x);
      const ys = this.window.map((s) => s.y);
      const spreadX = spread(xs);
      const spreadY = spread(ys);
      if (
        spreadX <= EYE_GAZE_BASELINE_MAX_X_SPREAD &&
        spreadY <= EYE_GAZE_BASELINE_MAX_Y_SPREAD
      ) {
        this.locked = {
          ready: true,
          x: median(xs),
          y: median(ys),
          sampleCount: this.window.length,
          confidence: median(this.window.map((s) => s.confidence)),
          spreadX,
          spreadY,
        };
        this.window = [];
        return this.locked;
      }
    }

    return this.pendingState();
  }

  private pendingState(): EyeGazeBaselineState {
    if (this.window.length === 0) return emptyState();
    const xs = this.window.map((s) => s.x);
    const ys = this.window.map((s) => s.y);
    return {
      ready: false,
      x: null,
      y: null,
      sampleCount: this.window.length,
      confidence: 0,
      spreadX: spread(xs),
      spreadY: spread(ys),
    };
  }
}

// function separationConfidence(
//   base: number,
//   direction: EyeGazeDirection,
//   deltaX: number,
//   deltaY: number,
// ): number {
//   let separation = 1;
//   if (direction === "LEFT") {
//     const past = -deltaX - EYE_GAZE_LEFT_DELTA_THRESHOLD;
//     separation = Math.min(1, Math.max(0.55, 0.55 + past / 0.12));
//   } else if (direction === "RIGHT") {
//     const past = deltaX - EYE_GAZE_RIGHT_DELTA_THRESHOLD;
//     separation = Math.min(1, Math.max(0.55, 0.55 + past / 0.12));
//   } else if (direction === "DOWN") {
//     const past = deltaY - EYE_GAZE_DOWN_DELTA_THRESHOLD;
//     separation = Math.min(1, Math.max(0.55, 0.55 + past / 0.16));
//   } else if (direction === "CENTER") {
//     const nx = Math.abs(deltaX) / EYE_GAZE_LEFT_DELTA_THRESHOLD;
//     const ny = Math.max(0, deltaY) / EYE_GAZE_DOWN_DELTA_THRESHOLD;
//     separation = Math.min(1, Math.max(0.5, 1 - 0.4 * Math.max(nx, ny)));
//   }
//   return Math.min(1, Math.max(0, base * separation));
// }







function separationConfidence(
  base: number,
  direction: EyeGazeDirection,
  deltaX: number,
  deltaY: number,
): number {
  let separation = 1;
  if (direction === "LEFT") {
    const past = -deltaX - EYE_GAZE_LEFT_DELTA_THRESHOLD;
    // Hardcoded 0.12 ki jagah constant use karein
    separation = Math.min(1, Math.max(0.55, 0.55 + past / EYE_GAZE_LEFT_DELTA_THRESHOLD));
  } else if (direction === "RIGHT") {
    const past = deltaX - EYE_GAZE_RIGHT_DELTA_THRESHOLD;
    // Hardcoded 0.12 ki jagah constant use karein
    separation = Math.min(1, Math.max(0.55, 0.55 + past / EYE_GAZE_RIGHT_DELTA_THRESHOLD));
  } else if (direction === "DOWN") {
    const past = deltaY - EYE_GAZE_DOWN_DELTA_THRESHOLD;
    // Hardcoded 0.16 ki jagah constant use karein
    separation = Math.min(1, Math.max(0.55, 0.55 + past / EYE_GAZE_DOWN_DELTA_THRESHOLD));
  } else if (direction === "CENTER") {
    const nx = Math.abs(deltaX) / EYE_GAZE_LEFT_DELTA_THRESHOLD;
    const ny = Math.max(0, deltaY) / EYE_GAZE_DOWN_DELTA_THRESHOLD;
    separation = Math.min(1, Math.max(0.5, 1 - 0.4 * Math.max(nx, ny)));
  }
  return Math.min(1, Math.max(0, base * separation));
}


/**
 * Primary direction after a baseline exists.
 * Negative deltaX is LEFT and positive deltaX is RIGHT, matching synthetic
 * iris placement (low x → LEFT, high x → RIGHT). Positive deltaY is DOWN.
 * Before the baseline is ready, direction is UNKNOWN and must not warn.
 */
export function classifyGazeAgainstBaseline(
  estimate: EyeGazeEstimate,
  baseline: EyeGazeBaselineState,
): ClassifiedEyeGaze {
  const fusedX = estimate.fusedNormalizedX;
  const fusedY = estimate.fusedNormalizedY;

  if (!baseline.ready || baseline.x == null || baseline.y == null) {
    const geometryFailed = estimate.direction === "UNKNOWN" && Boolean(estimate.reason);
    return {
      estimate: {
        ...estimate,
        direction: "UNKNOWN",
        reason: geometryFailed ? estimate.reason : "baseline_not_ready",
      },
      deltaX: null,
      deltaY: null,
    };
  }

  const deltaX =
    fusedX != null && Number.isFinite(fusedX) ? fusedX - baseline.x : null;
  const deltaY =
    fusedY != null && Number.isFinite(fusedY) ? fusedY - baseline.y : null;

  if (estimate.direction === "UNKNOWN") {
    return { estimate, deltaX, deltaY };
  }

  if (deltaX == null || deltaY == null) {
    return {
      estimate: {
        ...estimate,
        direction: "UNKNOWN",
        confidence: 0,
        reason: "missing_fused_ratio",
      },
      deltaX,
      deltaY,
    };
  }

  const leftExcess = -deltaX - EYE_GAZE_LEFT_DELTA_THRESHOLD;
  const rightExcess = deltaX - EYE_GAZE_RIGHT_DELTA_THRESHOLD;
  const downExcess = deltaY - EYE_GAZE_DOWN_DELTA_THRESHOLD;

  let direction: EyeGazeDirection = "CENTER";
  if (
    downExcess >= 0 &&
    downExcess >= leftExcess &&
    downExcess >= rightExcess
  ) {
    direction = "DOWN";
  } else if (leftExcess >= 0 && leftExcess >= rightExcess) {
    direction = "LEFT";
  } else if (rightExcess >= 0) {
    direction = "RIGHT";
  }

  const confidence = separationConfidence(
    estimate.confidence,
    direction,
    deltaX,
    deltaY,
  );
  if (confidence < EYE_GAZE_MIN_CONFIDENCE) {
    return {
      estimate: {
        ...estimate,
        direction: "UNKNOWN",
        confidence,
        reason: "low_confidence",
      },
      deltaX,
      deltaY,
    };
  }

  return {
    estimate: {
      ...estimate,
      direction,
      confidence,
      reason: undefined,
    },
    deltaX,
    deltaY,
  };
}

export function eyeGazeCalibrationStatusLabel(input: {
  tracking: boolean;
  baselineReady: boolean;
  lowConfidence: boolean;
}): string {
  if (!input.tracking) return "Tracking unavailable";
  if (!input.baselineReady) return "Collecting neutral eye baseline…";
  if (input.lowConfidence) return "Low confidence";
  return "Baseline ready";
}
