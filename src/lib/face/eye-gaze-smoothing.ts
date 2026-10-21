import {
  EYE_GAZE_SMOOTH_MIN_AGREEMENT,
  EYE_GAZE_SMOOTH_WINDOW,
} from "@/lib/face/eye-gaze-constants";
import type { EyeGazeDirection, EyeGazeEstimate, EyeGazeTelemetry } from "@/types/eye-gaze";

type HistoryEntry = {
  direction: EyeGazeDirection;
  confidence: number;
  atMs: number;
};

/**
 * Stateful temporal smoother for eye-gaze estimates.
 * Independent of head-pose episode timers.
 */
export class EyeGazeSmoother {
  private history: HistoryEntry[] = [];
  private stableDirection: EyeGazeDirection = "UNKNOWN";
  private episodeStartMs: number | null = null;
  private lastAtMs = 0;

  reset() {
    this.history = [];
    this.stableDirection = "UNKNOWN";
    this.episodeStartMs = null;
    this.lastAtMs = 0;
  }

  push(estimate: EyeGazeEstimate, atMs = Date.now()): EyeGazeTelemetry {
    this.lastAtMs = atMs;
    this.history.push({
      direction: estimate.direction,
      confidence: estimate.confidence,
      atMs,
    });
    if (this.history.length > EYE_GAZE_SMOOTH_WINDOW) {
      this.history.shift();
    }

    const nextStable = this.computeStable();
    if (nextStable !== this.stableDirection) {
      this.stableDirection = nextStable;
      this.episodeStartMs =
        nextStable === "UNKNOWN" || nextStable === "CENTER" ? null : atMs;
      // CENTER also tracks duration for telemetry (how long centered).
      if (nextStable === "CENTER") {
        this.episodeStartMs = atMs;
      }
    } else if (
      this.episodeStartMs == null &&
      (nextStable === "LEFT" ||
        nextStable === "RIGHT" ||
        nextStable === "DOWN" ||
        nextStable === "CENTER")
    ) {
      this.episodeStartMs = atMs;
    }

    if (nextStable === "UNKNOWN") {
      this.episodeStartMs = null;
    }

    const durationMs =
      this.episodeStartMs != null && this.stableDirection !== "UNKNOWN"
        ? Math.max(0, atMs - this.episodeStartMs)
        : 0;

    return {
      rawDirection: estimate.direction,
      stableDirection: this.stableDirection,
      confidence: estimate.confidence,
      durationMs,
      landmarkCount: estimate.landmarkCount,
      leftNormalizedX: estimate.leftEye.normalizedX,
      rightNormalizedX: estimate.rightEye.normalizedX,
      fusedNormalizedX: estimate.fusedNormalizedX,
      fusedNormalizedY: estimate.fusedNormalizedY,
      headYaw: estimate.headYaw,
      headPitch: estimate.headPitch,
      reason: estimate.reason,
    };
  }

  private computeStable(): EyeGazeDirection {
    if (this.history.length === 0) return "UNKNOWN";

    const counts = new Map<EyeGazeDirection, { score: number; n: number }>();
    for (const entry of this.history) {
      const weight = entry.direction === "UNKNOWN" ? 0.35 : Math.max(0.15, entry.confidence);
      const prev = counts.get(entry.direction) ?? { score: 0, n: 0 };
      counts.set(entry.direction, {
        score: prev.score + weight,
        n: prev.n + 1,
      });
    }

    let best: EyeGazeDirection = "UNKNOWN";
    let bestScore = -1;
    let bestN = 0;
    for (const [direction, { score, n }] of counts) {
      if (score > bestScore || (score === bestScore && n > bestN)) {
        best = direction;
        bestScore = score;
        bestN = n;
      }
    }

    // Require agreement to leave UNKNOWN or flip away from current stable.
    if (best === this.stableDirection) {
      return best;
    }

    if (bestN < EYE_GAZE_SMOOTH_MIN_AGREEMENT && this.history.length >= EYE_GAZE_SMOOTH_WINDOW) {
      // Not enough agreement — keep stable unless flooded with UNKNOWN.
      const unknownN = counts.get("UNKNOWN")?.n ?? 0;
      if (unknownN >= EYE_GAZE_SMOOTH_MIN_AGREEMENT) {
        return "UNKNOWN";
      }
      return this.stableDirection;
    }

    if (bestN < EYE_GAZE_SMOOTH_MIN_AGREEMENT) {
      // Warm-up: prefer UNKNOWN until window fills with agreement.
      return best === "UNKNOWN" || this.stableDirection === "UNKNOWN"
        ? best
        : this.stableDirection;
    }

    return best;
  }
}
