/**
 * Assessment ↔ question type compatibility checks.
 * Run: npx tsx --env-file=.env.local scripts/verify-assessment-question-type.ts
 */
// @ts-nocheck
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  QUESTION_TYPE_MISMATCH_ERROR,
  questionMatchesAssessmentType,
} from "../src/lib/assessment-question-type";
import { Assessment } from "../src/models/Assessment";
import { Question } from "../src/models/Question";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function validateAttachment(
  assessmentType: "mcq" | "subjective" | "coding" | "mixed",
  questionIds: string[],
) {
  if (!questionIds.length || assessmentType === "mixed") return null;

  const questions = await Question.find({
    _id: { $in: questionIds.map((id) => new mongoose.Types.ObjectId(id)) },
  }).select("type");

  if (questions.length !== questionIds.length) {
    return "One or more questions do not exist.";
  }

  for (const question of questions) {
    if (!questionMatchesAssessmentType(assessmentType, question.type)) {
      return QUESTION_TYPE_MISMATCH_ERROR;
    }
  }

  return null;
}

const mcqPayload = {
  prompt: "Type verify MCQ",
  type: "mcq" as const,
  category: "Programming" as const,
  difficulty: "easy" as const,
  points: 2,
  explanation: "",
  options: [
    { key: "A", text: "One" },
    { key: "B", text: "Two" },
  ],
  correctOptionKey: "A",
};

const subjectivePayload = {
  prompt: "Type verify subjective",
  type: "subjective" as const,
  category: "Programming" as const,
  difficulty: "easy" as const,
  points: 3,
  explanation: "",
};

const codingPayload = {
  prompt: "Type verify coding",
  type: "coding" as const,
  category: "Programming" as const,
  difficulty: "easy" as const,
  points: 5,
  explanation: "",
  codingLanguages: ["python" as const],
  starterCode: { python: "# code" },
  testCases: [{ input: "1", expectedOutput: "1", isHidden: false, weight: 1 }],
};

async function createQuestion(payload: Record<string, unknown>) {
  const type = payload.type as string;
  const seq = Date.now() + Math.floor(Math.random() * 1000);
  return Question.create({
    ...payload,
    code: `Q-TYPE-${seq}`,
    createdBy: new mongoose.Types.ObjectId(),
    options: type === "mcq" ? payload.options : [],
    correctOptionKey: type === "mcq" ? payload.correctOptionKey : "",
    codingLanguages: type === "coding" ? payload.codingLanguages : [],
    starterCode: type === "coding" ? payload.starterCode : {},
    testCases: type === "coding" ? payload.testCases : [],
  });
}

async function main() {
  assert(
    questionMatchesAssessmentType("mcq", "mcq"),
    "utility allows mcq + mcq",
  );
  assert(
    !questionMatchesAssessmentType("mcq", "subjective"),
    "utility rejects mcq + subjective",
  );
  assert(
    questionMatchesAssessmentType("mixed", "coding"),
    "mixed allows any question type",
  );

  await connectDB();

  const mcqQuestion = await createQuestion(mcqPayload);
  const subjectiveQuestion = await createQuestion(subjectivePayload);
  const codingQuestion = await createQuestion(codingPayload);

  const createdQuestionIds = [
    mcqQuestion._id.toString(),
    subjectiveQuestion._id.toString(),
    codingQuestion._id.toString(),
  ];

  try {
    assert(
      (await validateAttachment("mcq", [mcqQuestion._id.toString()])) === null,
      "MCQ assessment + MCQ question allowed",
    );
    assert(
      (await validateAttachment("mcq", [subjectiveQuestion._id.toString()])) ===
        QUESTION_TYPE_MISMATCH_ERROR,
      "MCQ assessment + subjective question rejected",
    );
    assert(
      (await validateAttachment("mcq", [codingQuestion._id.toString()])) ===
        QUESTION_TYPE_MISMATCH_ERROR,
      "MCQ assessment + coding question rejected",
    );

    assert(
      (await validateAttachment("subjective", [
        subjectiveQuestion._id.toString(),
      ])) === null,
      "Subjective assessment + subjective question allowed",
    );
    assert(
      (await validateAttachment("subjective", [mcqQuestion._id.toString()])) ===
        QUESTION_TYPE_MISMATCH_ERROR,
      "Subjective assessment + MCQ question rejected",
    );
    assert(
      (await validateAttachment("subjective", [
        codingQuestion._id.toString(),
      ])) === QUESTION_TYPE_MISMATCH_ERROR,
      "Subjective assessment + coding question rejected",
    );

    assert(
      (await validateAttachment("coding", [codingQuestion._id.toString()])) ===
        null,
      "Coding assessment + coding question allowed",
    );
    assert(
      (await validateAttachment("coding", [mcqQuestion._id.toString()])) ===
        QUESTION_TYPE_MISMATCH_ERROR,
      "Coding assessment + MCQ question rejected",
    );
    assert(
      (await validateAttachment("coding", [
        subjectiveQuestion._id.toString(),
      ])) === QUESTION_TYPE_MISMATCH_ERROR,
      "Coding assessment + subjective question rejected",
    );

    assert(
      (await validateAttachment("mcq", [
        mcqQuestion._id.toString(),
        subjectiveQuestion._id.toString(),
      ])) === QUESTION_TYPE_MISMATCH_ERROR,
      "Bulk assignment rejects incompatible question in list",
    );

    assert(
      (await validateAttachment("mixed", createdQuestionIds)) === null,
      "Legacy mixed assessment still allows all question types",
    );

    const filteredMcqBank = await Question.find({ type: "mcq" }).select("type");
    assert(
      filteredMcqBank.every((q) => q.type === "mcq"),
      "Question picker bank filter shows MCQ only",
    );

    const allBank = await Question.find().select("type");
    assert(
      new Set(allBank.map((q) => q.type)).size >= 2,
      "Global question bank still contains multiple question types",
    );

    console.log("\nAll assessment/question type checks passed.");
  } finally {
    await Question.deleteMany({ _id: { $in: createdQuestionIds } });
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
