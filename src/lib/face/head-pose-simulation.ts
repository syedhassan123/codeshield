import type { HeadOrientation } from "@/lib/face/head-pose-orientation";

export type HeadPoseSimulationMode =
  | "NORMAL"
  | "LOOKING_LEFT"
  | "LOOKING_RIGHT"
  | "LOOKING_UP"
  | "LOOKING_DOWN"
  | "NO_FACE"
  | "MULTIPLE_FACES";

let simulatedMode: HeadPoseSimulationMode | null = null;

export function isHeadPoseSimulationEnabled() {
  return process.env.NODE_ENV === "development";
}

export function setHeadPoseSimulationMode(mode: HeadPoseSimulationMode | null) {
  if (!isHeadPoseSimulationEnabled()) return;
  simulatedMode = mode;
}

export function getHeadPoseSimulationMode() {
  if (!isHeadPoseSimulationEnabled()) return null;
  return simulatedMode;
}

export function simulationToOrientation(
  mode: HeadPoseSimulationMode,
): HeadOrientation | "NO_FACE" | "MULTIPLE_FACES" {
  switch (mode) {
    case "LOOKING_LEFT":
      return "LEFT";
    case "LOOKING_RIGHT":
      return "RIGHT";
    case "LOOKING_UP":
      return "UP";
    case "LOOKING_DOWN":
      return "DOWN";
    case "NO_FACE":
      return "NO_FACE";
    case "MULTIPLE_FACES":
      return "MULTIPLE_FACES";
    default:
      return "NORMAL";
  }
}

/** Dev-only: attach simulation helpers to window for manual testing. */
export function attachHeadPoseSimulationToWindow() {
  if (!isHeadPoseSimulationEnabled() || typeof window === "undefined") return;

  const api = {
    setMode: setHeadPoseSimulationMode,
    clear: () => setHeadPoseSimulationMode(null),
    modes: [
      "NORMAL",
      "LOOKING_LEFT",
      "LOOKING_RIGHT",
      "LOOKING_UP",
      "LOOKING_DOWN",
      "NO_FACE",
      "MULTIPLE_FACES",
    ] as const,
  };

  (window as Window & { __EXAM_HEAD_POSE_SIM__?: typeof api }).__EXAM_HEAD_POSE_SIM__ =
    api;
}
