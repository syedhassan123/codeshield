import {
  EYE_GAZE_DOWN_THRESHOLD,
  EYE_GAZE_EXPECTED_LANDMARK_COUNT,
  EYE_GAZE_EXTREME_PITCH_DEG,
  EYE_GAZE_EXTREME_YAW_DEG,
  EYE_GAZE_EYE_DISAGREE_MAX,
  EYE_GAZE_HORIZONTAL_CENTER_MAX,
  EYE_GAZE_HORIZONTAL_CENTER_MIN,
  EYE_GAZE_MIN_CONFIDENCE,
  EYE_GAZE_MIN_EYE_HEIGHT,
  EYE_GAZE_MIN_EYE_WIDTH,
  EYE_GAZE_MIN_VISIBILITY,
  EYE_GAZE_SOFT_YAW_DEG,
} from "@/lib/face/eye-gaze-constants";
import { LEFT_EYE, RIGHT_EYE } from "@/lib/face/eye-gaze-landmarks";
import type {
  EyeGazeDirection,
  EyeGazeEstimate,
  EyeGazeEyeGeometry,
} from "@/types/eye-gaze";

/** Minimal landmark point — compatible with MediaPipe NormalizedLandmark. */
export type GazeLandmarkPoint = {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
};

export type EstimateEyeGazeInput = {
  landmarks: GazeLandmarkPoint[];
  headYaw: number | null;
  headPitch: number | null;
};

function emptyEye(): EyeGazeEyeGeometry {
  return {
    normalizedX: null,
    normalizedY: null,
    eyeWidth: null,
    eyeHeight: null,
    usable: false,
  };
}

function unknownEstimate(
  partial: Partial<EyeGazeEstimate> & { reason: string },
): EyeGazeEstimate {
  return {
    direction: "UNKNOWN",
    confidence: 0,
    landmarkCount: partial.landmarkCount ?? 0,
    leftEye: partial.leftEye ?? emptyEye(),
    rightEye: partial.rightEye ?? emptyEye(),
    fusedNormalizedX: partial.fusedNormalizedX ?? null,
    fusedNormalizedY: partial.fusedNormalizedY ?? null,
    headYaw: partial.headYaw ?? null,
    headPitch: partial.headPitch ?? null,
    reason: partial.reason,
  };
}

function pointOk(p: GazeLandmarkPoint | undefined): p is GazeLandmarkPoint {
  if (!p) return false;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  // Face Landmarker doesn't populate visibility (always 0) — unlike Pose
  // Landmarker, so 0 means "unknown", not "occluded". Only reject when the
  // value is a genuine partial-visibility signal (> 0 and below threshold).
  if (
    typeof p.visibility === "number" &&
    p.visibility > 0 &&
    p.visibility < EYE_GAZE_MIN_VISIBILITY
  ) {
    return false;
  }
  return true;
}

function measureEye(
  landmarks: GazeLandmarkPoint[],
  indices: {
    outer: number;
    inner: number;
    upper: number;
    lower: number;
    irisCenter: number;
  },
): EyeGazeEyeGeometry {
  const outer = landmarks[indices.outer];
  const inner = landmarks[indices.inner];
  const upper = landmarks[indices.upper];
  const lower = landmarks[indices.lower];
  const iris = landmarks[indices.irisCenter];


if (process.env.NODE_ENV === "development") {
  console.log("[EYE-MEASURE]", {
    vis: [outer, inner, upper, lower, iris].map((p) => p?.visibility),
    minVis: EYE_GAZE_MIN_VISIBILITY,
    w: Math.abs((outer?.x ?? 0) - (inner?.x ?? 0)),
    h: Math.abs((upper?.y ?? 0) - (lower?.y ?? 0)),
    minW: EYE_GAZE_MIN_EYE_WIDTH,
    minH: EYE_GAZE_MIN_EYE_HEIGHT,
    ny: iris && upper && lower
      ? (iris.y - Math.min(upper.y, lower.y)) /
        Math.abs(upper.y - lower.y)
      : null,
  });
}


  if (
    !pointOk(outer) ||
    !pointOk(inner) ||
    !pointOk(upper) ||
    !pointOk(lower) ||
    !pointOk(iris)
  ) {
    return emptyEye();
  }

  const eyeLeftX = Math.min(outer.x, inner.x);
  const eyeRightX = Math.max(outer.x, inner.x);
  const eyeTopY = Math.min(upper.y, lower.y);
  const eyeBottomY = Math.max(upper.y, lower.y);
  const eyeWidth = eyeRightX - eyeLeftX;
  const eyeHeight = eyeBottomY - eyeTopY;

  if (eyeWidth < EYE_GAZE_MIN_EYE_WIDTH || eyeHeight < EYE_GAZE_MIN_EYE_HEIGHT) {
    return {
      normalizedX: null,
      normalizedY: null,
      eyeWidth,
      eyeHeight,
      usable: false,
    };
  }

  const normalizedX = (iris.x - eyeLeftX) / eyeWidth;
  const normalizedY = (iris.y - eyeTopY) / eyeHeight;

  if (
    !Number.isFinite(normalizedX) ||
    !Number.isFinite(normalizedY) ||
    normalizedX < -0.15 ||
    normalizedX > 1.15 ||
    normalizedY < -0.15 ||
    normalizedY > 1.15
  ) {
    return {
      normalizedX: null,
      normalizedY: null,
      eyeWidth,
      eyeHeight,
      usable: false,
    };
  }

  return {
    normalizedX: Math.min(1, Math.max(0, normalizedX)),
    normalizedY: Math.min(1, Math.max(0, normalizedY)),
    eyeWidth,
    eyeHeight,
    usable: true,
  };
}

function classifyHorizontal(fusedX: number): EyeGazeDirection {
  if (fusedX < EYE_GAZE_HORIZONTAL_CENTER_MIN) return "LEFT";
  if (fusedX > EYE_GAZE_HORIZONTAL_CENTER_MAX) return "RIGHT";
  return "CENTER";
}

function headConfidenceFactor(yaw: number | null, pitch: number | null): number {
  if (yaw == null || pitch == null) return 0.85;
  const absYaw = Math.abs(yaw);
  const absPitch = Math.abs(pitch);
  if (absYaw >= EYE_GAZE_EXTREME_YAW_DEG || absPitch >= EYE_GAZE_EXTREME_PITCH_DEG) {
    return 0;
  }
  if (absYaw <= EYE_GAZE_SOFT_YAW_DEG && absPitch <= EYE_GAZE_SOFT_YAW_DEG) {
    return 1;
  }
  const yawSpan = EYE_GAZE_EXTREME_YAW_DEG - EYE_GAZE_SOFT_YAW_DEG;
  const pitchSpan = EYE_GAZE_EXTREME_PITCH_DEG - EYE_GAZE_SOFT_YAW_DEG;
  const yawT = Math.min(1, Math.max(0, (absYaw - EYE_GAZE_SOFT_YAW_DEG) / yawSpan));
  const pitchT = Math.min(
    1,
    Math.max(0, (absPitch - EYE_GAZE_SOFT_YAW_DEG) / pitchSpan),
  );
  return 1 - 0.55 * Math.max(yawT, pitchT);
}

function boundaryConfidence(fusedX: number, fusedY: number, direction: EyeGazeDirection) {
  if (direction === "DOWN") {
    return Math.min(1, Math.max(0.2, (fusedY - EYE_GAZE_DOWN_THRESHOLD) / 0.2 + 0.4));
  }
  if (direction === "CENTER") {
    const mid = 0.5;
    const dist = Math.abs(fusedX - mid);
    const halfBand =
      (EYE_GAZE_HORIZONTAL_CENTER_MAX - EYE_GAZE_HORIZONTAL_CENTER_MIN) / 2;
    return Math.min(1, Math.max(0.35, 1 - dist / (halfBand + 0.05)));
  }
  if (direction === "LEFT") {
    return Math.min(
      1,
      Math.max(0.25, (EYE_GAZE_HORIZONTAL_CENTER_MIN - fusedX) / 0.2 + 0.4),
    );
  }
  if (direction === "RIGHT") {
    return Math.min(
      1,
      Math.max(0.25, (fusedX - EYE_GAZE_HORIZONTAL_CENTER_MAX) / 0.2 + 0.4),
    );
  }
  return 0;
}

/**
 * Pure geometric eye-gaze estimate from Face Landmarker landmarks.
 * Does not mutate head-pose state. Heuristic confidence in [0, 1].
 *
 * `direction` here is the absolute-band diagnostic (0.35–0.65 CENTER).
 * Student warnings use baseline-relative direction from eye-gaze-baseline.ts.
 */
export function estimateEyeGaze(input: EstimateEyeGazeInput): EyeGazeEstimate {
  const { landmarks, headYaw, headPitch } = input;
  const landmarkCount = landmarks.length;

  if (landmarkCount !== EYE_GAZE_EXPECTED_LANDMARK_COUNT) {
    return unknownEstimate({
      landmarkCount,
      headYaw,
      headPitch,
      reason: `landmark_count=${landmarkCount}`,
    });
  }

  const leftEye = measureEye(landmarks, LEFT_EYE);
  const rightEye = measureEye(landmarks, RIGHT_EYE);

  if (!leftEye.usable && !rightEye.usable) {
    return unknownEstimate({
      landmarkCount,
      leftEye,
      rightEye,
      headYaw,
      headPitch,
      reason: "eyes_unusable",
    });
  }

  if (
    leftEye.usable &&
    rightEye.usable &&
    leftEye.normalizedX != null &&
    rightEye.normalizedX != null &&
    Math.abs(leftEye.normalizedX - rightEye.normalizedX) > EYE_GAZE_EYE_DISAGREE_MAX
  ) {
    return unknownEstimate({
      landmarkCount,
      leftEye,
      rightEye,
      fusedNormalizedX:
        (leftEye.normalizedX + rightEye.normalizedX) / 2,
      fusedNormalizedY:
        leftEye.normalizedY != null && rightEye.normalizedY != null
          ? (leftEye.normalizedY + rightEye.normalizedY) / 2
          : null,
      headYaw,
      headPitch,
      reason: "eyes_disagree",
    });
  }

  const xs = [leftEye, rightEye]
    .filter((e) => e.usable && e.normalizedX != null)
    .map((e) => e.normalizedX as number);
  const ys = [leftEye, rightEye]
    .filter((e) => e.usable && e.normalizedY != null)
    .map((e) => e.normalizedY as number);

  const fusedNormalizedX =
    xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  const fusedNormalizedY =
    ys.length > 0 ? ys.reduce((a, b) => a + b, 0) / ys.length : null;

  if (fusedNormalizedX == null || fusedNormalizedY == null) {
    return unknownEstimate({
      landmarkCount,
      leftEye,
      rightEye,
      fusedNormalizedX,
      fusedNormalizedY,
      headYaw,
      headPitch,
      reason: "missing_fused_ratio",
    });
  }

  const headFactor = headConfidenceFactor(headYaw, headPitch);
  if (headFactor <= 0) {
    return unknownEstimate({
      landmarkCount,
      leftEye,
      rightEye,
      fusedNormalizedX,
      fusedNormalizedY,
      headYaw,
      headPitch,
      reason: "extreme_head_pose",
    });
  }

  const direction: EyeGazeDirection =
    fusedNormalizedY >= EYE_GAZE_DOWN_THRESHOLD
      ? "DOWN"
      : classifyHorizontal(fusedNormalizedX);

  const bothEyes = leftEye.usable && rightEye.usable ? 1 : 0.72;
  const boundary = boundaryConfidence(
    fusedNormalizedX,
    fusedNormalizedY,
    direction,
  );
  const confidence = Math.min(1, Math.max(0, boundary * headFactor * bothEyes));

  if (confidence < EYE_GAZE_MIN_CONFIDENCE) {
    return {
      direction: "UNKNOWN",
      confidence,
      landmarkCount,
      leftEye,
      rightEye,
      fusedNormalizedX,
      fusedNormalizedY,
      headYaw,
      headPitch,
      reason: "low_confidence",
    };
  }

  return {
    direction,
    confidence,
    landmarkCount,
    leftEye,
    rightEye,
    fusedNormalizedX,
    fusedNormalizedY,
    headYaw,
    headPitch,
  };
}

/** Build a flat landmark array of the expected size for synthetic tests. */
export function createSyntheticLandmarkFrame(
  overrides: Record<number, { x: number; y: number; visibility?: number }>,
): GazeLandmarkPoint[] {
  const landmarks: GazeLandmarkPoint[] = Array.from(
    { length: EYE_GAZE_EXPECTED_LANDMARK_COUNT },
    () => ({ x: 0.5, y: 0.5, visibility: 1 }),
  );
  for (const [index, point] of Object.entries(overrides)) {
    landmarks[Number(index)] = {
      x: point.x,
      y: point.y,
      visibility: point.visibility ?? 1,
    };
  }
  return landmarks;
}

/**
 * Place a centered or offset iris inside an eye box for synthetic tests.
 * Eye corners/lids define the box; irisOffsetX/Y are in [0,1] within that box.
 */
export function placeSyntheticEye(
  overrides: Record<number, { x: number; y: number }>,
  eye: typeof LEFT_EYE | typeof RIGHT_EYE,
  box: { left: number; right: number; top: number; bottom: number },
  irisOffset: { x: number; y: number },
) {
  overrides[eye.outer] = { x: box.left, y: (box.top + box.bottom) / 2 };
  overrides[eye.inner] = { x: box.right, y: (box.top + box.bottom) / 2 };
  // Ensure outer/inner span matches left/right regardless of which is which.
  overrides[eye.outer] = { x: box.left, y: (box.top + box.bottom) / 2 };
  overrides[eye.inner] = { x: box.right, y: (box.top + box.bottom) / 2 };
  overrides[eye.upper] = { x: (box.left + box.right) / 2, y: box.top };
  overrides[eye.lower] = { x: (box.left + box.right) / 2, y: box.bottom };
  const irisX = box.left + irisOffset.x * (box.right - box.left);
  const irisY = box.top + irisOffset.y * (box.bottom - box.top);
  overrides[eye.irisCenter] = { x: irisX, y: irisY };
  for (const ring of eye.irisRing) {
    overrides[ring] = { x: irisX, y: irisY };
  }
}
