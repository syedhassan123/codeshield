export const QUESTION_TYPES = ["mcq", "subjective", "coding"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_CATEGORIES = [
  "Programming",
  "Database",
  "Networking",
  "AI",
  "Mathematics",
  "English",
  "Aptitude",
] as const;
export type QuestionCategory = (typeof QUESTION_CATEGORIES)[number];

export const ASSESSMENT_TYPES = ["mcq", "subjective", "coding", "mixed"] as const;
export type AssessmentType = (typeof ASSESSMENT_TYPES)[number];

export const ASSESSMENT_STATUSES = [
  "draft",
  "scheduled",
  "published",
  "completed",
] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const CODING_LANGUAGES = [
  "python",
  "javascript",
  "java",
  "cpp",
] as const;
export type CodingLanguage = (typeof CODING_LANGUAGES)[number];
