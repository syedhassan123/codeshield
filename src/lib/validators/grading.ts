import { z } from "zod";
import {
  REVIEW_CATEGORIES,
  type ReviewCategory,
} from "@/lib/proctoring/review";

const REVIEW_CATEGORY_FILTERS = ["all", ...REVIEW_CATEGORIES] as [
  "all",
  ReviewCategory,
  ...ReviewCategory[],
];

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

export const suggestSubjectiveGradeSchema = z.object({
  attemptId: z.string().min(1).max(64),
  questionId: z.string().min(1).max(64),
});

export const proctoringReviewQueueSchema = z.object({
  windowDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).optional().default(30),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
  risk: z
    .enum(["all", "needs_review", "LOW", "MEDIUM", "HIGH", "CRITICAL"])
    .optional()
    .default("needs_review"),
  category: z.enum(REVIEW_CATEGORY_FILTERS).optional().default("all"),
  assessmentId: z.string().optional().default("all"),
  studentId: z.string().optional().default("all"),
  status: z
    .enum(["all", "in_progress", "submitted", "expired"])
    .optional()
    .default("all"),
  search: z.string().max(120).optional().default(""),
  review: z
    .enum([
      "all",
      "active",
      "unreviewed",
      "cleared",
      "flagged",
      "needs_follow_up",
    ])
    .optional()
    .default("active"),
});

export const proctoringCaseReviewSchema = z.object({
  attemptId: z.string().min(1).max(64),
  decision: z.enum(["CLEARED", "FLAGGED", "NEEDS_FOLLOW_UP"]),
  note: z.string().max(5000).optional().default(""),
  expectedVersion: z.coerce.number().int().min(0),
});
