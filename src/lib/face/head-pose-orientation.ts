import { MIN_SIGNIFICANT_HEAD_ANGLE_DEG } from "@/lib/face/head-pose-constants";

export type HeadOrientation =
  | "NORMAL"
  | "LEFT"
  | "RIGHT"
  | "UP"
  | "DOWN";

export type HeadPoseAngles = {
  yaw: number;
  pitch: number;
  roll: number;
};

/** Extract approximate head Euler angles from a 4x4 facial transformation matrix. */
export function anglesFromFacialMatrix(data: number[]): HeadPoseAngles | null {
  if (data.length < 16) return null;

  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const r00 = data[0];
  const r10 = data[4];
  const r20 = data[8];
  const r21 = data[9];
  const r22 = data[10];

  const pitch = Math.asin(-clamp(r20)) * (180 / Math.PI);
  const yaw = Math.atan2(r10, r00) * (180 / Math.PI);
  const roll = Math.atan2(r21, r22) * (180 / Math.PI);

  if (!Number.isFinite(yaw) || !Number.isFinite(pitch) || !Number.isFinite(roll)) {
    return null;
  }

  return { yaw, pitch, roll };
}

/**
 * Classify head orientation from yaw/pitch.
 * Uses the dominant axis above the significant angle threshold.
 */
export function classifyHeadOrientation(
  angles: HeadPoseAngles,
  minAngleDeg = MIN_SIGNIFICANT_HEAD_ANGLE_DEG,
): HeadOrientation {
  const absYaw = Math.abs(angles.yaw);
  const absPitch = Math.abs(angles.pitch);

  if (absYaw < minAngleDeg && absPitch < minAngleDeg) {
    return "NORMAL";
  }

  if (absYaw >= absPitch) {
    return angles.yaw > 0 ? "RIGHT" : "LEFT";
  }

  return angles.pitch > 0 ? "DOWN" : "UP";
}

export function orientationToEventType(
  orientation: Exclude<HeadOrientation, "NORMAL">,
):
  | "HEAD_LOOKING_LEFT"
  | "HEAD_LOOKING_RIGHT"
  | "HEAD_LOOKING_UP"
  | "HEAD_LOOKING_DOWN" {
  switch (orientation) {
    case "LEFT":
      return "HEAD_LOOKING_LEFT";
    case "RIGHT":
      return "HEAD_LOOKING_RIGHT";
    case "UP":
      return "HEAD_LOOKING_UP";
    case "DOWN":
      return "HEAD_LOOKING_DOWN";
  }
}
