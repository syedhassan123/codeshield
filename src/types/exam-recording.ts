export const RECORDING_STATUSES = [
  "RECORDING",
  "UPLOADING",
  "READY",
  "FAILED",
] as const;

export type RecordingStatus = (typeof RECORDING_STATUSES)[number];
