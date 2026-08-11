import { z } from "zod";

export const adminAttemptFilterSchema = z.object({
  assessmentId: z.string().optional().default("all"),
  studentId: z.string().optional().default("all"),
  status: z
    .enum(["all", "in_progress", "submitted", "expired"])
    .optional()
    .default("all"),
  evaluationStatus: z
    .enum(["all", "pending", "completed", "none"])
    .optional()
    .default("all"),
  search: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const gradeQuestionSchema = z.object({
  attemptId: z.string().min(1),
  questionId: z.string().min(1),
  marks: z.coerce.number().min(0, "Marks cannot be negative."),
  feedback: z
    .string()
    .max(2000, "Feedback is too long.")
    .optional()
    .default(""),
});
