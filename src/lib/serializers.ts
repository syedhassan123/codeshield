import type { AssessmentDocument } from "@/models/Assessment";
import type { QuestionDocument } from "@/models/Question";

export function serializeQuestion(doc: QuestionDocument) {
  const starter =
    doc.starterCode instanceof Map
      ? Object.fromEntries(doc.starterCode.entries())
      : ((doc.starterCode as Record<string, string> | undefined) ?? {});

  return {
    id: doc._id.toString(),
    code: doc.code,
    prompt: doc.prompt,
    type: doc.type,
    category: doc.category,
    difficulty: doc.difficulty,
    points: doc.points,
    explanation: doc.explanation ?? "",
    options: (doc.options ?? []).map((o) => ({
      key: o.key,
      text: o.text,
    })),
    correctOptionKey: doc.correctOptionKey ?? "",
    codingLanguages: doc.codingLanguages ?? [],
    starterCode: starter,
    testCases: (doc.testCases ?? []).map((t) => ({
      input: t.input,
      expectedOutput: t.expectedOutput,
      isHidden: Boolean(t.isHidden),
    })),
    createdAt: toIso((doc as { createdAt?: Date }).createdAt),
    updatedAt: toIso((doc as { updatedAt?: Date }).updatedAt),
  };
}

export type SerializedQuestion = ReturnType<typeof serializeQuestion>;

function toIso(value?: Date | string | null) {
  if (!value) return new Date().toISOString();
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function serializeAssessment(
  doc: AssessmentDocument,
  extras?: { questionCount?: number; computedMarks?: number },
) {
  return {
    id: doc._id.toString(),
    code: doc.code,
    title: doc.title,
    description: doc.description ?? "",
    instructions: doc.instructions ?? "",
    type: doc.type,
    category: doc.category,
    difficulty: doc.difficulty,
    status: doc.status,
    durationMin: doc.durationMin,
    totalMarks: extras?.computedMarks ?? doc.totalMarks,
    questionIds: (doc.questionIds ?? []).map((id) => id.toString()),
    questionCount: extras?.questionCount ?? (doc.questionIds?.length ?? 0),
    visibility: doc.visibility ?? "all",
    assignedStudentIds: (doc.assignedStudentIds ?? []).map((id) =>
      id.toString(),
    ),
    scheduledAt: doc.scheduledAt
      ? new Date(doc.scheduledAt).toISOString()
      : null,
    publishedAt: doc.publishedAt
      ? new Date(doc.publishedAt).toISOString()
      : null,
    createdAt: toIso((doc as { createdAt?: Date }).createdAt),
    updatedAt: toIso((doc as { updatedAt?: Date }).updatedAt),
  };
}

export type SerializedAssessment = ReturnType<typeof serializeAssessment>;

export function displayType(type: string) {
  if (type === "mcq") return "MCQ";
  if (type === "mixed") return "Mixed";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function displayDifficulty(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function displayStatus(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
