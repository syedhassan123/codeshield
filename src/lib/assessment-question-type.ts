import type { AssessmentType, QuestionType } from "@/types/assessment";

export const QUESTION_TYPE_MISMATCH_ERROR =
  "Question type does not match the assessment type.";

/** Typed assessments (non-mixed) only allow one matching question type. */
export function assessmentRestrictsQuestionType(
  assessmentType: AssessmentType,
): assessmentType is QuestionType {
  return assessmentType !== "mixed";
}

export function questionMatchesAssessmentType(
  assessmentType: AssessmentType,
  questionType: QuestionType,
): boolean {
  if (assessmentType === "mixed") return true;
  return assessmentType === questionType;
}

export function requiredQuestionTypeForAssessment(
  assessmentType: AssessmentType,
): QuestionType | null {
  if (assessmentType === "mixed") return null;
  return assessmentType;
}
