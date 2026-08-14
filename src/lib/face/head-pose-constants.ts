/** Minimum head angle (degrees) before looking-away timing starts. */
export const MIN_SIGNIFICANT_HEAD_ANGLE_DEG = 25;

/** Soft warning + first observation after sustained looking away (ms). */
export const HEAD_WARNING_THRESHOLD_MS = 20_000;

/** Higher-priority prolonged observation threshold (ms). */
export const HEAD_PROLONGED_THRESHOLD_MS = 30_000;

/** Qualifying episodes within window before repeated observation. */
export const HEAD_REPEATED_EPISODE_COUNT = 3;

/** Rolling window for repeated looking-away episodes (ms). */
export const HEAD_REPEATED_WINDOW_MS = 300_000;

/** Client cooldown between persisted head observation events (ms). */
export const HEAD_EVENT_COOLDOWN_MS = 5_000;

/** MediaPipe face landmarker model (Google-hosted). */
export const FACE_LANDMARKER_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
