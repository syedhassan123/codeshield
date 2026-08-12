import { z } from "zod";
import {
  CODING_LANGUAGES,
  DIFFICULTIES,
  QUESTION_CATEGORIES,
  QUESTION_TYPES,
} from "@/types/assessment";

const optionSchema = z.object({
  key: z.string().min(1),
  text: z.string(),
});

const testCaseSchema = z.object({
  input: z.string(),
  expectedOutput: z.string(),
  isHidden: z.boolean().optional().default(false),
  weight: z.coerce.number().min(0).max(100).optional().default(1),
});

const exampleSchema = z.object({
  input: z.string().optional().default(""),
  output: z.string().optional().default(""),
  explanation: z.string().optional().default(""),
});

export const questionInputSchema = z
  .object({
    prompt: z.string().trim().min(5, "Question text is required"),
    type: z.enum(QUESTION_TYPES),
    category: z.enum(QUESTION_CATEGORIES),
    difficulty: z.enum(DIFFICULTIES),
    points: z.coerce.number().int().min(1).max(100),
    explanation: z.string().trim().optional().default(""),
    options: z.array(optionSchema).optional().default([]),
    correctOptionKey: z.string().optional().default(""),
    constraints: z.string().optional().default(""),
    inputFormat: z.string().optional().default(""),
    outputFormat: z.string().optional().default(""),
    examples: z.array(exampleSchema).optional().default([]),
    timeLimitMs: z.coerce.number().int().min(100).max(15000).optional().default(3000),
    memoryLimitMb: z.coerce.number().int().min(32).max(1024).optional().default(256),
    codingLanguages: z.array(z.enum(CODING_LANGUAGES)).optional().default([]),
    starterCode: z.record(z.string(), z.string()).optional().default({}),
    testCases: z.array(testCaseSchema).optional().default([]),
  })
  .superRefine((data, ctx) => {
    if (data.type === "mcq") {
      const filled = data.options.filter((o) => o.text.trim().length > 0);
      if (filled.length < 2) {
        ctx.addIssue({
          code: "custom",
          message: "MCQ needs at least 2 options with text",
          path: ["options"],
        });
      }
      if (!data.correctOptionKey) {
        ctx.addIssue({
          code: "custom",
          message: "Select a correct answer",
          path: ["correctOptionKey"],
        });
      } else if (!filled.some((o) => o.key === data.correctOptionKey)) {
        ctx.addIssue({
          code: "custom",
          message: "Correct answer must match a filled option",
          path: ["correctOptionKey"],
        });
      }
    }

    if (data.type === "coding") {
      if (!data.codingLanguages.length) {
        ctx.addIssue({
          code: "custom",
          message: "Select at least one coding language",
          path: ["codingLanguages"],
        });
      }
      // Keep exact stdin/stdout text (including newlines). Only reject fully empty pairs.
      const validTests = data.testCases.filter(
        (t) => t.input.length > 0 && t.expectedOutput.length > 0,
      );
      if (!validTests.length) {
        ctx.addIssue({
          code: "custom",
          message: "Add at least one complete test case",
          path: ["testCases"],
        });
      }
    }
  })
  .transform((data) => {
    if (data.type === "mcq") {
      return {
        ...data,
        options: data.options
          .map((o) => ({ ...o, text: o.text.trim() }))
          .filter((o) => o.text.length > 0),
        codingLanguages: [],
        starterCode: {},
        testCases: [],
        examples: [],
        constraints: "",
        inputFormat: "",
        outputFormat: "",
      };
    }

    if (data.type === "coding") {
      return {
        ...data,
        options: [],
        correctOptionKey: "",
        // Do not trim/normalize test stdin or expected output — preserve exact bytes for the runner.
        testCases: data.testCases
          .map((t) => ({
            ...t,
            input: t.input,
            expectedOutput: t.expectedOutput,
            weight: t.weight ?? 1,
            isHidden: Boolean(t.isHidden),
          }))
          .filter((t) => t.input.length > 0 && t.expectedOutput.length > 0),
        examples: (data.examples || [])
          .map((e) => ({
            input: (e.input || "").trim(),
            output: (e.output || "").trim(),
            explanation: (e.explanation || "").trim(),
          }))
          .filter((e) => e.input || e.output),
      };
    }

    return {
      ...data,
      options: [],
      correctOptionKey: "",
      codingLanguages: [],
      starterCode: {},
      testCases: [],
      examples: [],
      constraints: "",
      inputFormat: "",
      outputFormat: "",
    };
  });

export const questionFilterSchema = z.object({
  search: z.string().optional().default(""),
  category: z
    .enum(QUESTION_CATEGORIES)
    .or(z.literal("all"))
    .optional()
    .default("all"),
  type: z.enum(QUESTION_TYPES).or(z.literal("all")).optional().default("all"),
  difficulty: z
    .enum(DIFFICULTIES)
    .or(z.literal("all"))
    .optional()
    .default("all"),
});

export type QuestionInput = z.infer<typeof questionInputSchema>;
