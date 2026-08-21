import { z } from "zod";

export const adminStudentFilterSchema = z.object({
  search: z.string().optional().default(""),
  status: z
    .enum(["all", "active", "pending", "suspended"])
    .optional()
    .default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const adminReportFilterSchema = z.object({
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
  dateFrom: z.string().optional().default(""),
  dateTo: z.string().optional().default(""),
  riskLevel: z.enum(["all", "LOW", "MEDIUM", "HIGH"]).optional().default("all"),
  search: z.string().optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type AdminReportFilterInput = z.infer<typeof adminReportFilterSchema>;
