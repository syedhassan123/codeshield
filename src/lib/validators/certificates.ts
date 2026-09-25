import { z } from "zod";

export const adminCertificateFilterSchema = z.object({
  search: z.string().optional().default(""),
  status: z.enum(["all", "issued", "revoked"]).optional().default("all"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export const revokeCertificateSchema = z.object({
  certificateId: z.string().min(1),
  reason: z.string().trim().min(3, "Reason must be at least 3 characters.").max(500),
});

export const reinstateCertificateSchema = z.object({
  certificateId: z.string().min(1),
});
