/**
 * Phase 2 exam flow verification against MongoDB.
 * Run: npx tsx --env-file=.env.local scripts/verify-phase2-exam.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  ensureAttemptNotExpired,
  finalizeAttempt,
  getOwnedAttempt,
} from "../src/lib/exam/finalize";
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
  const other = await User.findOne({ email: "rohan@codeshield.edu" });
  assert(student, "demo student exists");
  assert(other, "other student exists");

  const assessment = await Assessment.findOne({
    status: "published",
    code: "ASM-201",
  });
  assert(assessment, "published ASM-201 exists");
  assert(assessment!.questionIds.length > 0, "assessment has questions");

  // Cleanup previous verification data for this student/assessment
  const prior = await Attempt.find({
    studentId: student!._id,
    assessmentId: assessment!._id,
  });
  const priorIds = prior.map((a) => a._id);
  if (priorIds.length) {
    await Answer.deleteMany({ attemptId: { $in: priorIds } });
    await Result.deleteMany({ attemptId: { $in: priorIds } });
    await Attempt.deleteMany({ _id: { $in: priorIds } });
  }

  // Ensure indexes after cleanup (partial unique on in_progress)
  try {
    await Attempt.collection.dropIndex("studentId_1_assessmentId_1");
  } catch {
    // index may not exist
  }
  await Promise.all([
    Attempt.syncIndexes(),
    Answer.syncIndexes(),
    Result.syncIndexes(),
  ]);

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + 60 * 60 * 1000);
  const attempt = await Attempt.create({
    studentId: student!._id,
    assessmentId: assessment!._id,
    status: "in_progress",
    startedAt,
    expiresAt,
    durationMin: assessment!.durationMin,
    questionIds: assessment!.questionIds,
    assessmentTitle: assessment!.title,
    totalMarks: assessment!.totalMarks,
  });
  assert(attempt.status === "in_progress", "attempt created");

  // App-level: only one active attempt
  const activeCount = await Attempt.countDocuments({
    studentId: student!._id,
    assessmentId: assessment!._id,
    status: "in_progress",
  });
  assert(activeCount === 1, "single active attempt for student+assessment");

  // DB-level: duplicate in_progress blocked by partial unique index
  let duplicateBlocked = false;
  try {
    await Attempt.create({
      studentId: student!._id,
      assessmentId: assessment!._id,
      status: "in_progress",
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
      durationMin: 10,
      questionIds: assessment!.questionIds,
      assessmentTitle: assessment!.title,
      totalMarks: assessment!.totalMarks,
    });
  } catch (error) {
    duplicateBlocked =
      error instanceof Error &&
      (error.message.includes("E11000") || error.name === "MongoServerError");
  }
  assert(duplicateBlocked, "duplicate active attempt blocked");

  // Ownership
  let ownershipDenied = false;
  try {
    await getOwnedAttempt(attempt._id.toString(), other!._id.toString());
  } catch {
    ownershipDenied = true;
  }
  assert(ownershipDenied, "other student cannot access attempt");

  const owned = await getOwnedAttempt(
    attempt._id.toString(),
    student!._id.toString(),
  );
  assert(owned._id.equals(attempt._id), "owner can access attempt");

  const questions = await Question.find({
    _id: { $in: assessment!.questionIds },
  });
  const mcq = questions.find((q) => q.type === "mcq");
  assert(mcq, "has at least one MCQ");

  await Answer.findOneAndUpdate(
    {
      attemptId: attempt._id,
      questionId: mcq!._id,
      studentId: student!._id,
    },
    {
      $set: {
        selectedOptionKey: mcq!.correctOptionKey,
        textAnswer: "",
      },
    },
    { upsert: true },
  );

  const reloaded = await Answer.findOne({
    attemptId: attempt._id,
    questionId: mcq!._id,
  });
  assert(
    reloaded?.selectedOptionKey === mcq!.correctOptionKey,
    "answer survives reload from DB",
  );

  const finalized = await finalizeAttempt(attempt, "submitted");
  assert(finalized.status === "submitted", "attempt submitted");
  const result = await Result.findOne({ attemptId: attempt._id });
  assert(result, "result created");
  assert(
    (result!.objectiveScore ?? 0) >= (mcq!.points ?? 0),
    "objective score includes correct MCQ",
  );

  const again = await finalizeAttempt(finalized, "submitted");
  assert(again.status === "submitted", "second finalize is idempotent");
  assert(again.status !== "in_progress", "closed attempt not in_progress");

  // Expired attempt path (new attempt after previous closed)
  const expiredAttempt = await Attempt.create({
    studentId: student!._id,
    assessmentId: assessment!._id,
    status: "in_progress",
    startedAt: new Date(Date.now() - 120000),
    expiresAt: new Date(Date.now() - 60000),
    durationMin: 1,
    questionIds: assessment!.questionIds,
    assessmentTitle: assessment!.title,
    totalMarks: assessment!.totalMarks,
  });
  const afterExpire = await ensureAttemptNotExpired(expiredAttempt);
  assert(afterExpire.status === "expired", "expired attempt auto-finalized");

  const draft = await Assessment.findOne({ status: "draft" });
  if (draft) {
    assert(draft.status !== "published", "draft assessment not published");
  }

  console.log("\nPhase 2 verification passed.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
