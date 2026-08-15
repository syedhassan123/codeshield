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

/** Read rotation-matrix element from a column-major 4×4 MediaPipe matrix. */
function matrixElement(data: number[], row: number, col: number): number {
  return data[col * 4 + row];
}

/**
 * Extract Tait-Bryan Euler angles (degrees) from a column-major 4×4 facial
 * transformation matrix. MediaPipe stores matrices the same way Three.js
 * `Matrix4.fromArray()` expects: index = column * 4 + row.
 */
export function anglesFromFacialMatrix(data: number[]): HeadPoseAngles | null {
  if (data.length < 16) return null;

  const clamp = (v: number) => Math.max(-1, Math.min(1, v));
  const r00 = matrixElement(data, 0, 0);
  const r10 = matrixElement(data, 1, 0);
  const r20 = matrixElement(data, 2, 0);
  const r21 = matrixElement(data, 2, 1);
  const r22 = matrixElement(data, 2, 2);

  const pitch = Math.asin(-clamp(r20)) * (180 / Math.PI);
  const yaw = Math.atan2(r10, r00) * (180 / Math.PI);
  const roll = Math.atan2(r21, r22) * (180 / Math.PI);

  if (!Number.isFinite(yaw) || !Number.isFinite(pitch) || !Number.isFinite(roll)) {
    return null;
  }

  return { yaw, pitch, roll };
}

/**
 * Map raw matrix Euler angles to head-monitoring semantics.
 * In MediaPipe's camera frame, horizontal head turns appear on the matrix
 * "pitch" channel and vertical nods on the "roll" channel.
 */
export function headMonitoringAnglesFromFacialMatrix(
  data: number[],
): HeadPoseAngles | null {
  const raw = anglesFromFacialMatrix(data);
  if (!raw) return null;

  return {
    yaw: raw.pitch,
    pitch: raw.roll,
    roll: raw.yaw,
  };
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

/** Build a column-major 4×4 matrix for testing (Y-axis rotation in degrees). */
export function buildColumnMajorYawMatrix(degrees: number): number[] {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

/** Build a column-major 4×4 matrix for testing (X-axis rotation in degrees). */
export function buildColumnMajorPitchMatrix(degrees: number): number[] {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}
