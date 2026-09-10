export const INTERVIEW_EVALUATION_STATUSES = ["submitted"] as const;
export type InterviewEvaluationStatus =
  (typeof INTERVIEW_EVALUATION_STATUSES)[number];
