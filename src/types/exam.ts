export const ATTEMPT_STATUSES = [
  "in_progress",
  "submitted",
  "expired",
] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ANSWER_EVAL_STATUSES = [
  "ungraded",
  "correct",
  "incorrect",
  "pending_evaluation",
  "manually_graded",
] as const;
export type AnswerEvalStatus = (typeof ANSWER_EVAL_STATUSES)[number];

export const EVALUATION_STATUSES = ["pending", "completed"] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];
