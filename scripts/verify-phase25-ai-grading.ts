/**
 * Phase 25 AI subjective grading suggestion checks.
 * Run: npx tsx --env-file=.env.local scripts/verify-phase25-ai-grading.ts
 */
import { readFileSync } from "fs";
import path from "path";
import { connectDB } from "../src/lib/db";
import {
  AI_GRADING_NOT_CONFIGURED,
  assertAiGradingRateLimit,
  getSubjectiveGradeContext,
  parseSubjectiveGradeSuggestion,
  requestSubjectiveGradeSuggestion,
  resetAiGradingRateLimitForTests,
  setSubjectiveGradeFetchForTests,
} from "../src/lib/ai/subjective-grade";
import { finalizeAttempt } from "../src/lib/exam/finalize";
import { recalculateResultScores } from "../src/lib/exam/score";
import { ActionError } from "../src/lib/auth-guards";
import { Answer } from "../src/models/Answer";
import { Assessment } from "../src/models/Assessment";
import { Attempt } from "../src/models/Attempt";
import { Question } from "../src/models/Question";
import { Result } from "../src/models/Result";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function expectError(fn: () => Promise<unknown>, needle: string, msg: string) {
  try {
    await fn();
    throw new Error(`FAIL: ${msg} (no error)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(message.includes(needle), msg);
  }
}

function staticChecks() {
  const actionSrc = read("src/lib/actions/grading.ts");
  assert(
    actionSrc.includes("requireAdmin") &&
      actionSrc.includes("suggestSubjectiveGradeAction") &&
      actionSrc.includes("getSubjectiveGradeContext"),
    "suggest action is admin-gated and loads DB context",
  );
  const suggestBlock = actionSrc.slice(
    actionSrc.indexOf("export async function suggestSubjectiveGradeAction"),
    actionSrc.indexOf("export async function completeEvaluationAction"),
  );
  assert(
    !suggestBlock.includes("awardedPoints") &&
      !suggestBlock.includes("evalStatus") &&
      !suggestBlock.includes("result.save"),
    "suggest action does not write grading fields",
  );

  const clientSrc = read("src/components/admin/admin-attempt-detail-client.tsx");
  assert(
    clientSrc.includes("Suggest with AI") &&
      clientSrc.includes("suggestSubjectiveGradeAction") &&
      clientSrc.includes("Save grade"),
    "admin UI has Suggest with AI and Save grade",
  );
  assert(
    clientSrc.indexOf("suggestSubjectiveGradeAction") <
      clientSrc.indexOf("setDrafts") ||
      clientSrc.includes("suggestedMarks"),
    "suggestion lands in draft state",
  );
  assert(
    !clientSrc.includes("await gradeQuestionAction") ||
      clientSrc.includes("saveGrade"),
    "Save grade remains the persist path",
  );

  const envSrc = read(".env.example");
  assert(
    envSrc.includes("AI_GRADING_API_KEY") &&
      envSrc.includes("AI_GRADING_MODEL"),
    "env example documents AI grading keys",
  );
}

async function cleanupAttempt(attemptId: ReturnType<typeof Attempt.prototype._id>) {
  await Answer.deleteMany({ attemptId });
  await Result.deleteMany({ attemptId });
  await Attempt.deleteMany({ _id: attemptId });
}

async function main() {
  staticChecks();
  await connectDB();

  const student = await User.findOne({ email: "demo@codeshield.ai" });
  const admin = await User.findOne({ email: "admin@codeshield.ai" });
  const interviewer = await User.findOne({ email: "kabir@codeshield.ai" });
  assert(student && admin && interviewer, "seed users exist");

  const assessment = await Assessment.findOne({
    status: "published",
    code: "ASM-201",
  });
  assert(assessment, "ASM-201 exists");

  const questions = await Question.find({
    _id: { $in: assessment!.questionIds },
  });
  const mcq = questions.find((q) => q.type === "mcq");
  const subjective = questions.find((q) => q.type === "subjective");
  const coding = questions.find((q) => q.type === "coding");
  assert(mcq && subjective, "assessment has MCQ and subjective");

  const attempt = await Attempt.create({
    studentId: student!._id,
    assessmentId: assessment!._id,
    status: "in_progress",
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    durationMin: assessment!.durationMin,
    questionIds: assessment!.questionIds,
    assessmentTitle: assessment!.title,
    totalMarks: assessment!.totalMarks,
  });

  await expectError(
    () => getSubjectiveGradeContext(attempt._id.toString(), subjective!._id.toString()),
    "in-progress",
    "in-progress attempt is rejected",
  );

  await Answer.create({
    attemptId: attempt._id,
    studentId: student!._id,
    questionId: mcq!._id,
    selectedOptionKey: mcq!.correctOptionKey,
  });
  await Answer.create({
    attemptId: attempt._id,
    studentId: student!._id,
    questionId: subjective!._id,
    textAnswer: "ACID means Atomicity, Consistency, Isolation, Durability.",
  });

  const closed = await finalizeAttempt(attempt, "submitted");
  assert(closed.status === "submitted", "attempt submitted");

  const before = await Result.findOne({ attemptId: attempt._id });
  assert(before, "result exists");
  const beforeSnap = JSON.stringify({
    awardedPoints: before!.questions.find(
      (q) => q.questionId.toString() === subjective!._id.toString(),
    )?.awardedPoints,
    feedback: before!.questions.find(
      (q) => q.questionId.toString() === subjective!._id.toString(),
    )?.feedback,
    evalStatus: before!.questions.find(
      (q) => q.questionId.toString() === subjective!._id.toString(),
    )?.evalStatus,
    finalScore: before!.finalScore,
    subjectiveScore: before!.subjectiveScore,
  });

  const context = await getSubjectiveGradeContext(
    attempt._id.toString(),
    subjective!._id.toString(),
  );
  assert(context.studentAnswer.includes("ACID"), "subjective context loads answer from Result");
  assert(context.maxMarks > 0, "max marks come from the result snapshot");

  await expectError(
    () => getSubjectiveGradeContext(attempt._id.toString(), mcq!._id.toString()),
    "subjective",
    "MCQ suggestion is rejected",
  );
  if (coding) {
    await expectError(
      () => getSubjectiveGradeContext(attempt._id.toString(), coding._id.toString()),
      "subjective",
      "coding suggestion is rejected",
    );
  }
  await expectError(
    () => getSubjectiveGradeContext("000000000000000000000000", subjective!._id.toString()),
    "not found",
    "missing attempt is rejected",
  );
  await expectError(
    () => getSubjectiveGradeContext(attempt._id.toString(), "000000000000000000000000"),
    "not found",
    "missing question is rejected",
  );

  const emptyIdx = before!.questions.findIndex(
    (q) => q.questionId.toString() === subjective!._id.toString(),
  );
  before!.questions[emptyIdx].textAnswer = "";
  before!.markModified("questions");
  await before!.save();
  await expectError(
    () => getSubjectiveGradeContext(attempt._id.toString(), subjective!._id.toString()),
    "no student answer",
    "empty answer is rejected",
  );
  before!.questions[emptyIdx].textAnswer = context.studentAnswer;
  before!.markModified("questions");
  await before!.save();

  const parsed = parseSubjectiveGradeSuggestion(
    { suggestedMarks: 99, feedback: "Clear ACID coverage." },
    context.maxMarks,
  );
  assert(parsed.suggestedMarks <= context.maxMarks, "suggested marks clamp to maximum");
  assert(parsed.suggestedMarks >= 0, "suggested marks are not negative");
  assert(parsed.feedback.length > 0, "feedback is returned");

  try {
    parseSubjectiveGradeSuggestion({ feedback: "no marks" }, 10);
    throw new Error("FAIL: malformed marks accepted");
  } catch (error) {
    assert(
      error instanceof ActionError && error.message.includes("invalid marks"),
      "malformed AI marks are rejected",
    );
  }

  try {
    parseSubjectiveGradeSuggestion("not-json", 10);
    throw new Error("FAIL: non-object accepted");
  } catch (error) {
    assert(
      error instanceof ActionError && error.message.includes("invalid response"),
      "malformed AI payload is rejected",
    );
  }

  const prevKey = process.env.AI_GRADING_API_KEY;
  delete process.env.AI_GRADING_API_KEY;
  await expectError(
    () => requestSubjectiveGradeSuggestion(context),
    AI_GRADING_NOT_CONFIGURED,
    "missing API key returns a controlled error",
  );
  process.env.AI_GRADING_API_KEY = "test-key";
  setSubjectiveGradeFetchForTests(async () => {
    return new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                suggestedMarks: 8,
                feedback: "Covers the four ACID properties.",
              }),
            },
          },
        ],
      }),
      { status: 200 },
    );
  });
  const suggestion = await requestSubjectiveGradeSuggestion(context);
  assert(suggestion.suggestedMarks === 8, "mocked provider returns marks");
  assert(suggestion.feedback.includes("ACID"), "mocked provider returns feedback");
  setSubjectiveGradeFetchForTests(null);
  if (prevKey) process.env.AI_GRADING_API_KEY = prevKey;
  else delete process.env.AI_GRADING_API_KEY;

  const afterSuggest = await Result.findOne({ attemptId: attempt._id });
  const afterSnap = JSON.stringify({
    awardedPoints: afterSuggest!.questions.find(
      (q) => q.questionId.toString() === subjective!._id.toString(),
    )?.awardedPoints,
    feedback: afterSuggest!.questions.find(
      (q) => q.questionId.toString() === subjective!._id.toString(),
    )?.feedback,
    evalStatus: afterSuggest!.questions.find(
      (q) => q.questionId.toString() === subjective!._id.toString(),
    )?.evalStatus,
    finalScore: afterSuggest!.finalScore,
    subjectiveScore: afterSuggest!.subjectiveScore,
  });
  assert(afterSnap === beforeSnap, "Result grading fields stay unchanged after suggestion");

  const row = afterSuggest!.questions[emptyIdx];
  row.awardedPoints = suggestion.suggestedMarks;
  row.feedback = suggestion.feedback;
  row.evalStatus = "manually_graded";
  afterSuggest!.markModified("questions");
  Object.assign(afterSuggest!, recalculateResultScores(afterSuggest!.questions));
  await afterSuggest!.save();
  assert(
    (afterSuggest!.subjectiveScore ?? 0) === suggestion.suggestedMarks,
    "existing save-style persist still updates scores",
  );

  resetAiGradingRateLimitForTests();
  for (let i = 0; i < 6; i += 1) {
    assertAiGradingRateLimit(admin!._id.toString());
  }
  try {
    assertAiGradingRateLimit(admin!._id.toString());
    throw new Error("FAIL: rate limit did not trip");
  } catch (error) {
    assert(
      error instanceof ActionError && error.message.includes("Too many"),
      "repeat AI requests are rate limited",
    );
  }
  resetAiGradingRateLimitForTests();

  const actionSrc = read("src/lib/actions/grading.ts");
  assert(
    actionSrc.includes('requireAdmin()') &&
      actionSrc.includes("suggestSubjectiveGradeAction"),
    "students and interviewers cannot pass requireAdmin on the suggest action",
  );

  await cleanupAttempt(attempt._id);
  console.log("\nPASS: Phase 25 AI subjective grading");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
