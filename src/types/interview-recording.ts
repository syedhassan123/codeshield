export const INTERVIEW_RECORDING_STATUSES = [
  "RECORDING",
  "UPLOADING",
  "READY",
  "FAILED",
] as const;

export type InterviewRecordingStatus =
  (typeof INTERVIEW_RECORDING_STATUSES)[number];

export const INTERVIEW_RECORDING_MODES = ["egress", "client"] as const;

export type InterviewRecordingMode =
  (typeof INTERVIEW_RECORDING_MODES)[number];

export const INTERVIEW_RECORDING_NOT_FOUND = "Interview not found.";
