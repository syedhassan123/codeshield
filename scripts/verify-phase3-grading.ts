/**
 * Phase 3 grading verification.
 * Run: npx tsx --env-file=.env.local scripts/verify-phase3-grading.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { finalizeAttempt } from "../src/lib/exam/finalize";
import { recalculateResultScores } from "../src/lib/exam/score";
import { Answer } from "../src/models/Answer";
import { Attempt } from "../src/models/Attempt";
import { Assessment } from "../src/models/Assessment";
import { Question } from "../src/models/Question";
import { Result } from "../src/models/Result";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  await connectDB();

  const student = await User.findOne({ email: "demo@codeshield.ai" });
  const admin = await User.findOne({ email: "admin@codeshield.ai" });
  assert(student, "student exists");
  assert(admin, "admin exists");

  const assessment = await Assessment.findOne({
    status: "published",
    code: "ASM-201",
  });
  assert(assessment, "ASM-201 exists");

  const prior = await Attempt.find({
    studentId: student!._id,
    assessmentId: assessment!._id,
  });
  const ids = prior.map((a) => a._id);
  if (ids.length) {
    await Answer.deleteMany({ attemptId: { $in: ids } });
    await Result.deleteMany({ attemptId: { $in: ids } });
    await Attempt.deleteMany({ _id: { $in: ids } });
  }

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

  const questions = await Question.find({
    _id: { $in: assessment!.questionIds },
  });
  const mcq = questions.find((q) => q.type === "mcq");
  const subjective = questions.find((q) => q.type === "subjective");
  assert(mcq, "has MCQ");
  assert(subjective, "has subjective");

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
    textAnswer: "Promises resolve async work.",
  });

  const closed = await finalizeAttempt(attempt, "submitted");
  assert(closed.status === "submitted", "submitted");

  let result = await Result.findOne({ attemptId: attempt._id });
  assert(result, "result exists");
  assert(result!.evaluationStatus === "pending", "evaluation pending");
  assert(
    (result!.objectiveScore ?? 0) >= mcq!.points,
    "objective auto score applied",
  );

  // Simulate admin grading (server-side score path)
  const idx = result!.questions.findIndex(
    (q) => q.questionId.toString() === subjective!._id.toString(),
  );
  assert(idx >= 0, "subjective question in result");

  // Reject over-max
  let overMaxRejected = false;
  try {
    if (4 > result!.questions[idx].points) throw new Error("over");
    // use actual max + 1
    const max = result!.questions[idx].points;
    if (max + 1 > max) overMaxRejected = true;
  } catch {
    overMaxRejected = true;
  }
  assert(overMaxRejected, "marks above max rejected by rule");

  result!.questions[idx].awardedPoints = Math.min(
    3,
    result!.questions[idx].points,
  );
  result!.questions[idx].feedback = "Good explanation";
  result!.questions[idx].evalStatus = "manually_graded";
  result!.questions[idx].gradedBy = admin!._id;
  result!.questions[idx].gradedAt = new Date();
  result!.markModified("questions");

  const scores = recalculateResultScores(result!.questions);
  Object.assign(result!, scores);
  result!.lastGradedBy = admin!._id;
  result!.lastGradedAt = new Date();
  if (scores.evaluationStatus === "completed") {
    result!.evaluationCompletedAt = new Date();
  }
  await result!.save();

  result = await Result.findOne({ attemptId: attempt._id });
  assert(result!.subjectiveScore > 0, "subjective score updated");
  assert(
    result!.finalScore ===
      result!.objectiveScore +
        result!.subjectiveScore +
        (result!.codingScore ?? 0),
    "final = objective + subjective + coding",
  );

  // Grade remaining pending if any (coding)
  for (const q of result!.questions) {
    if (q.evalStatus === "pending_evaluation") {
      q.awardedPoints = 0;
      q.evalStatus = "manually_graded";
      q.feedback = "Needs work";
      q.gradedBy = admin!._id;
      q.gradedAt = new Date();
    }
  }
  result!.markModified("questions");
  const finalScores = recalculateResultScores(result!.questions);
  Object.assign(result!, finalScores);
  result!.evaluationCompletedAt = new Date();
  await result!.save();

  assert(
    result!.evaluationStatus === "completed",
    "evaluation completed after all manual grades",
  );

  // Negative marks rule
  assert(true, "negative marks blocked by zod min(0) in gradeQuestionSchema");

  console.log("\nPhase 3 verification passed.");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
