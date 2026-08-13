import type { AnswerDocument } from "@/models/Answer";
import type { AssessmentDocument } from "@/models/Assessment";
import type { AttemptDocument } from "@/models/Attempt";
import type { QuestionDocument } from "@/models/Question";
import type { ResultDocument } from "@/models/Result";
import { normalizeAssessmentSecurity } from "@/types/assessment-security";

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
    constraints: doc.constraints ?? "",
    inputFormat: doc.inputFormat ?? "",
    outputFormat: doc.outputFormat ?? "",
    examples: (doc.examples ?? []).map((e) => ({
      input: e.input ?? "",
      output: e.output ?? "",
      explanation: e.explanation ?? "",
    })),
    timeLimitMs: doc.timeLimitMs ?? 3000,
    memoryLimitMb: doc.memoryLimitMb ?? 256,
    codingLanguages: doc.codingLanguages ?? [],
    starterCode: starter,
    testCases: (doc.testCases ?? []).map((t) => ({
      input: t.input,
      expectedOutput: t.expectedOutput,
      isHidden: Boolean(t.isHidden),
      weight: t.weight ?? 1,
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
    security: normalizeAssessmentSecurity(
      doc.security as
        | {
            requireCamera?: boolean;
            requireFullscreen?: boolean;
            blockCopyPaste?: boolean;
            monitorTabSwitching?: boolean;
          }
        | null
        | undefined,
    ),
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

/** Student-facing question payload — never includes hidden tests or keys. */
export function serializeExamQuestion(doc: QuestionDocument) {
  const visibleCount = (doc.testCases ?? []).filter((t) => !t.isHidden).length;
  return {
    id: doc._id.toString(),
    code: doc.code,
    prompt: doc.prompt,
    type: doc.type,
    category: doc.category,
    difficulty: doc.difficulty,
    points: doc.points,
    options: (doc.options ?? []).map((o) => ({
      key: o.key,
      text: o.text,
    })),
    constraints: doc.constraints ?? "",
    inputFormat: doc.inputFormat ?? "",
    outputFormat: doc.outputFormat ?? "",
    examples: (doc.examples ?? []).map((e) => ({
      input: e.input ?? "",
      output: e.output ?? "",
      explanation: e.explanation ?? "",
    })),
    timeLimitMs: doc.timeLimitMs ?? 3000,
    memoryLimitMb: doc.memoryLimitMb ?? 256,
    visibleTestCount: visibleCount,
    codingLanguages: doc.codingLanguages ?? [],
    starterCode:
      doc.starterCode instanceof Map
        ? Object.fromEntries(doc.starterCode.entries())
        : ((doc.starterCode as Record<string, string> | undefined) ?? {}),
  };
}

export type SerializedExamQuestion = ReturnType<typeof serializeExamQuestion>;

export function serializeAnswer(doc: AnswerDocument) {
  return {
    id: doc._id.toString(),
    questionId: doc.questionId.toString(),
    selectedOptionKey: doc.selectedOptionKey ?? "",
    textAnswer: doc.textAnswer ?? "",
    updatedAt: toIso((doc as { updatedAt?: Date }).updatedAt),
  };
}

export type SerializedAnswer = ReturnType<typeof serializeAnswer>;

export function serializeAttempt(doc: AttemptDocument) {
  return {
    id: doc._id.toString(),
    studentId: doc.studentId.toString(),
    assessmentId: doc.assessmentId.toString(),
    status: doc.status,
    startedAt: toIso(doc.startedAt),
    expiresAt: toIso(doc.expiresAt),
    submittedAt: doc.submittedAt ? toIso(doc.submittedAt) : null,
    durationMin: doc.durationMin,
    questionIds: (doc.questionIds ?? []).map((id) => id.toString()),
    assessmentTitle: doc.assessmentTitle,
    totalMarks: doc.totalMarks,
    resultId: doc.resultId ? doc.resultId.toString() : null,
  };
}

export type SerializedAttempt = ReturnType<typeof serializeAttempt>;

export function serializeResult(doc: ResultDocument) {
  const subjectiveScore = doc.subjectiveScore ?? 0;
  const codingScore = doc.codingScore ?? 0;
  const codingMaxMarks = doc.codingMaxMarks ?? 0;
  const evaluationStatus = doc.evaluationStatus ?? "pending";
  const finalScore =
    doc.finalScore ??
    doc.objectiveScore + subjectiveScore + codingScore;

  return {
    id: doc._id.toString(),
    attemptId: doc.attemptId.toString(),
    assessmentId: doc.assessmentId.toString(),
    assessmentTitle: doc.assessmentTitle,
    objectiveScore: doc.objectiveScore,
    objectiveMaxMarks: doc.objectiveMaxMarks,
    subjectiveScore,
    subjectiveMaxMarks: doc.subjectiveMaxMarks,
    codingScore,
    codingMaxMarks,
    subjectivePendingCount: doc.subjectivePendingCount,
    finalScore,
    totalMarks: doc.totalMarks,
    evaluationStatus,
    submittedAt: toIso(doc.submittedAt),
    finalizedReason: doc.finalizedReason,
    lastGradedAt: doc.lastGradedAt ? toIso(doc.lastGradedAt) : null,
    evaluationCompletedAt: doc.evaluationCompletedAt
      ? toIso(doc.evaluationCompletedAt)
      : null,
    questions: (doc.questions ?? []).map((q) => ({
      questionId: q.questionId.toString(),
      type: q.type,
      points: q.points,
      awardedPoints: q.awardedPoints,
      evalStatus: q.evalStatus,
      selectedOptionKey: q.selectedOptionKey ?? "",
      correctOptionKey: q.correctOptionKey ?? "",
      textAnswer: q.textAnswer ?? "",
      prompt: q.prompt ?? "",
      feedback: q.feedback ?? "",
      gradedAt: q.gradedAt ? toIso(q.gradedAt) : null,
      passedTests: q.passedTests ?? 0,
      totalTests: q.totalTests ?? 0,
    })),
  };
}

export type SerializedResult = ReturnType<typeof serializeResult>;
