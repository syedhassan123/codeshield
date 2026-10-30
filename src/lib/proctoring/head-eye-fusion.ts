import type { EyeGazeAwayDirection } from "@/lib/face/eye-gaze-warning";
import type { HeadOrientation } from "@/lib/face/head-pose-orientation";
import type { EyeGazeDirection } from "@/types/eye-gaze";

export type CombinedAttentionState =
  | "HEAD_NORMAL_EYES_CENTER"
  | "HEAD_NORMAL_EYES_AWAY"
  | "HEAD_AWAY_EYES_CENTER_OR_UNKNOWN"
  | "HEAD_AWAY_EYES_AWAY"
  | "HEAD_EYE_DISAGREEMENT"
  | "UNKNOWN";

export type AttentionWarningSource = "none" | "head" | "eye" | "combined";

export type HeadEyeFusionInput = {
  headStatus: string;
  headOrientation: HeadOrientation | string;
  headWarning: boolean;
  headWarningTier: 0 | 1 | 2;
  stableEyeDirection: EyeGazeDirection;
  eyeAway: boolean;
  eyeWarningTier: 0 | 1 | 2;
  eyeConfidence: number;
};

export type HeadEyeFusionResult = {
  combinedAttentionState: CombinedAttentionState;
  warningSource: AttentionWarningSource;
  warningTier: 0 | 1 | 2;
  disagree: boolean;
};

/**
 * Single overlay source so head + eye never fight for the same full-screen UI.
 *
 * Precedence (below tab/fullscreen/security banner):
 *   combined / head prolonged
 *   → eye prolonged
 *   → head first warning
 *   → eye first warning
 *
 * Head warning is never suppressed because gaze is UNKNOWN or disagrees.
 */
export function resolveAttentionOverlay(
  headWarningTier: 0 | 1 | 2,
  eyeWarningTier: 0 | 1 | 2,
): { source: AttentionWarningSource; overlayTier: 0 | 1 | 2 } {
  const head = headWarningTier;
  const eye = eyeWarningTier;

  if (head <= 0 && eye <= 0) {
    return { source: "none", overlayTier: 0 };
  }
  if (head >= 2 && eye >= 1) {
    return { source: "combined", overlayTier: 2 };
  }
  if (head >= 2) {
    return { source: "head", overlayTier: 2 };
  }
  if (eye >= 2) {
    return { source: "eye", overlayTier: 2 };
  }
  if (head >= 1) {
    return { source: "head", overlayTier: 1 };
  }
  return { source: "eye", overlayTier: 1 };
}

function headAndEyeDisagree(
  headOrientation: string,
  eyeDirection: EyeGazeDirection,
  eyeAway: boolean,
): boolean {
  if (!eyeAway) return false;
  if (headOrientation === "LEFT" && eyeDirection === "RIGHT") return true;
  if (headOrientation === "RIGHT" && eyeDirection === "LEFT") return true;
  return false;
}

export function fuseHeadEyeAttention(
  input: HeadEyeFusionInput,
): HeadEyeFusionResult {
  const overlay = resolveAttentionOverlay(
    input.headWarningTier,
    input.eyeWarningTier,
  );

  const headUsable =
    input.headStatus === "active" ||
    input.headStatus === "looking_away" ||
    input.headStatus === "paused";

  if (!headUsable && !input.eyeAway && input.eyeWarningTier <= 0) {
    return {
      combinedAttentionState: "UNKNOWN",
      warningSource: overlay.source,
      warningTier: overlay.overlayTier,
      disagree: false,
    };
  }

  const headAway = input.headWarning || input.headWarningTier >= 1;
  const eyesCenter = input.stableEyeDirection === "CENTER";
  const eyesUnknown =
    input.stableEyeDirection === "UNKNOWN" || (!input.eyeAway && !eyesCenter);

  const disagree = headAndEyeDisagree(
    String(input.headOrientation),
    input.stableEyeDirection,
    input.eyeAway,
  );

  let combinedAttentionState: CombinedAttentionState;
  if (headAway && input.eyeAway) {
    combinedAttentionState = disagree
      ? "HEAD_EYE_DISAGREEMENT"
      : "HEAD_AWAY_EYES_AWAY";
  } else if (headAway) {
    combinedAttentionState = "HEAD_AWAY_EYES_CENTER_OR_UNKNOWN";
  } else if (input.eyeAway) {
    combinedAttentionState = "HEAD_NORMAL_EYES_AWAY";
  } else if (eyesCenter) {
    combinedAttentionState = "HEAD_NORMAL_EYES_CENTER";
  } else if (eyesUnknown && !headAway) {
    combinedAttentionState = "HEAD_NORMAL_EYES_CENTER";
  } else {
    combinedAttentionState = "UNKNOWN";
  }

  return {
    combinedAttentionState,
    warningSource: overlay.source,
    warningTier: overlay.overlayTier,
    disagree,
  };
}

export function eyeDirectionLabel(
  direction: EyeGazeAwayDirection | EyeGazeDirection | null,
): string | null {
  switch (direction) {
    case "LEFT":
      return "Your eyes appear to be looking to the left.";
    case "RIGHT":
      return "Your eyes appear to be looking to the right.";
    case "DOWN":
      return "Your eyes appear to be looking down.";
    default:
      return null;
  }
}
