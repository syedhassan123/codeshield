import { z } from "zod";

export const submitInterviewEvaluationSchema = z.object({
  interviewId: z.string().min(1),
  score: z.coerce
    .number()
    .min(0, "Score must be at least 0.")
    .max(100, "Score must be at most 100."),
  notes: z.string().max(5000, "Notes must be 5000 characters or fewer.").optional().default(""),
});

export type SubmitInterviewEvaluationInput = z.infer<
  typeof submitInterviewEvaluationSchema
>;
