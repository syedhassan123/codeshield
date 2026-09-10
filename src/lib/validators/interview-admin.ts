import { z } from "zod";
import { INTERVIEW_TYPES } from "@/types/interview";

/** Accept null/undefined/"" from forms; persist canonical null when empty. */
export function normalizeInterviewMeetingUrlInput(value: unknown) {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  return value;
}

const meetingUrlSchema = z.preprocess(
  normalizeInterviewMeetingUrlInput,
  z
    .string()
    .trim()
    .transform((value) => value || null)
    .refine(
      (value) => !value || /^https?:\/\//i.test(value),
      "Meeting URL must start with http:// or https://",
    ),
);

export function normalizeInterviewActionInput(raw: unknown) {
  if (typeof raw !== "object" || raw === null) {
    return raw;
  }
  const input = { ...(raw as Record<string, unknown>) };
  if ("meetingUrl" in input) {
    input.meetingUrl = normalizeInterviewMeetingUrlInput(input.meetingUrl);
  }
  return input;
}

export const createInterviewSchema = z.object({
  candidateId: z.string().min(1, "Candidate is required."),
  interviewerId: z.string().min(1, "Interviewer is required."),
  title: z.string().trim().min(1, "Title is required.").max(200),
  type: z.enum(INTERVIEW_TYPES),
  scheduledAt: z.string().min(1, "Scheduled date/time is required."),
  durationMin: z.coerce.number().int().min(1).max(480),
  meetingUrl: meetingUrlSchema.optional().default(null),
});

export const updateInterviewSchema = createInterviewSchema
  .partial()
  .extend({
    interviewId: z.string().min(1),
  });

export const cancelInterviewSchema = z.object({
  interviewId: z.string().min(1),
});

export type CreateInterviewInput = z.infer<typeof createInterviewSchema>;
export type UpdateInterviewInput = z.infer<typeof updateInterviewSchema>;
