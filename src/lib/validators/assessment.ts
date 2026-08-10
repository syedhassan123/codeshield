import { z } from "zod";
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TYPES,
  DIFFICULTIES,
  QUESTION_CATEGORIES,
} from "@/types/assessment";

export const assessmentInputSchema = z.object({
  title: z.string().trim().min(3, "Title is required"),
  description: z.string().trim().optional().default(""),
  instructions: z.string().trim().optional().default(""),
  type: z.enum(ASSESSMENT_TYPES),
  category: z.enum(QUESTION_CATEGORIES),
  difficulty: z.enum(DIFFICULTIES),
  durationMin: z.coerce.number().int().min(1).max(600),
  totalMarks: z.coerce.number().int().min(0).optional(),
  visibility: z.enum(["all", "assigned"]).optional().default("all"),
  assignedStudentIds: z.array(z.string()).optional().default([]),
  scheduledAt: z.string().optional().nullable(),
  questionIds: z.array(z.string()).optional().default([]),
});

export const assessmentStatusSchema = z.object({
  status: z.enum(ASSESSMENT_STATUSES),
});

export const assessmentQuestionsSchema = z.object({
  questionIds: z.array(z.string().min(1)),
});

export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
