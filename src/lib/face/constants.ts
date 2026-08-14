/** Face detection interval (~500ms). */
export const FACE_DETECTION_INTERVAL_MS = 500;

/** Sustained no-face duration before logging an observation (ms). */
export const FACE_NO_FACE_THRESHOLD_MS = 3000;

/** Sustained multiple-face duration before logging an observation (ms). */
export const FACE_MULTIPLE_THRESHOLD_MS = 2000;

/** Minimum time between persisted face observation events (ms). */
export const FACE_EVENT_COOLDOWN_MS = 5000;

/** MediaPipe WASM bundle (browser CDN). */
export const FACE_DETECTOR_WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";

/** BlazeFace short-range model (Google-hosted). */
export const FACE_DETECTOR_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
