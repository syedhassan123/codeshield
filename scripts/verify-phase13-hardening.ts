/**
 * Phase 13 production hardening checks.
 * Static + MongoDB (no browser/camera required).
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase13-hardening.ts
 */
import fs from "node:fs";
import path from "node:path";
import { connectDB } from "../src/lib/db";
import { findPublishedAssessmentForStudent } from "../src/lib/exam/access";
import {
  ensureAttemptNotExpired,
  finalizeAttempt,
  getOwnedAttempt,
} from "../src/lib/exam/finalize";
import { abandonIncompleteRecordings } from "../src/lib/exam/recording-finalize";
import { escapeCsvCell } from "../src/lib/admin/format";
import { ActionError } from "../src/lib/auth-guards";
import { Answer } from "../src/models/Answer";
import { Assessment } from "../src/models/Assessment";
import { Attempt } from "../src/models/Attempt";
import { ExamRecording } from "../src/models/ExamRecording";
import { Result } from "../src/models/Result";
import { User } from "../src/models/User";
import { RECORDING_STATUSES } from "../src/types/exam-recording";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function staticChecks() {
  const authSrc = read("src/lib/auth.ts");
  assert(
    !authSrc.includes("skipVerification"),
    "credentials authorize no longer trusts skipVerification",
  );

  const registerSrc = read("src/lib/actions/auth.ts");
  assert(
    registerSrc.includes('role: "student"'),
    "registration hardcodes student role",
  );
  assert(
    !registerSrc.includes("formData.get(\"role\")"),
    "registration does not read client role",
  );
  assert(
    registerSrc.includes("ALLOW_DEMO_LOGIN"),
    "demo login is environment-gated",
  );

  const sessionSrc = read("src/components/exam/exam-session-client.tsx");
  assert(
    sessionSrc.includes("flushPendingSaves"),
    "exam submit flushes pending autosaves",
  );
  assert(
    sessionSrc.includes("codingFlushRef"),
    "exam submit flushes coding drafts",
  );
  assert(
    sessionSrc.includes("router.replace") &&
      sessionSrc.indexOf("submitExamAction") <
        sessionSrc.lastIndexOf("router.replace"),
    "navigation waits for submitExamAction",
  );

  const codingNav = read("src/app/student/layout.tsx");
  assert(
    codingNav.includes("// { href: \"/student/coding\""),
    "standalone coding practice stays out of student nav",
  );

  const finalizeSrc = read("src/lib/exam/finalize.ts");
  assert(
    finalizeSrc.includes('status: "in_progress"') &&
      finalizeSrc.includes("FINALIZE_CLAIMED"),
    "finalize claims in_progress atomically",
  );
  assert(
    finalizeSrc.includes("expireOverdueInProgressAttempts"),
    "overdue attempt expiry helper exists",
  );
  assert(
    finalizeSrc.includes("abandonIncompleteRecordings"),
    "finalize abandons leftover recordings",
  );
  assert(
    finalizeSrc.includes('throw new ActionError("Attempt not found.")'),
    "ownership miss uses the same not-found message",
  );

  const recAction = read("src/lib/actions/exam-recording.ts");
  assert(
    recAction.includes('status: { $in: ["RECORDING", "UPLOADING", "FAILED"] }'),
    "recording upload uses atomic status claim",
  );

  assert(
    RECORDING_STATUSES.includes("FAILED"),
    "FAILED recording status exists",
  );

  assert(
    escapeCsvCell("=1+1").startsWith("'") &&
      escapeCsvCell("@SUM(A1)").startsWith("'"),
    "CSV formula injection is neutralized",
  );

  const debugSrc = read("src/lib/debug.ts");
  assert(
    debugSrc.includes("clientSafeErrorMessage"),
    "client-safe error sanitizer exists",
  );
}

async function mongoChecks() {
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

  const prior = await Attempt.find({
    studentId: student!._id,
    assessmentId: assessment!._id,
  });
  const priorIds = prior.map((a) => a._id);
  if (priorIds.length) {
    await Answer.deleteMany({ attemptId: { $in: priorIds } });
    await Result.deleteMany({ attemptId: { $in: priorIds } });
    await ExamRecording.deleteMany({ attemptId: { $in: priorIds } });
    await Attempt.deleteMany({ _id: { $in: priorIds } });
  }

  await Promise.all([Attempt.syncIndexes(), Result.syncIndexes()]);

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

  let ownershipDenied = false;
  try {
    await getOwnedAttempt(attempt._id.toString(), other!._id.toString());
  } catch (error) {
    ownershipDenied =
      error instanceof ActionError && error.message === "Attempt not found.";
  }
  assert(ownershipDenied, "cross-user attempt access is denied as not found");

  const owned = await getOwnedAttempt(
    attempt._id.toString(),
    student!._id.toString(),
  );
  assert(owned._id.equals(attempt._id), "owner can load attempt");

  await Answer.findOneAndUpdate(
    {
      attemptId: attempt._id,
      questionId: assessment!.questionIds[0],
      studentId: student!._id,
    },
    {
      $set: {
        selectedOptionKey: "A",
        textAnswer: "",
        studentId: student!._id,
        attemptId: attempt._id,
        questionId: assessment!.questionIds[0],
      },
    },
    { upsert: true },
  );

  const recording = await ExamRecording.create({
    attemptId: attempt._id,
    userId: student!._id,
    assessmentId: assessment!._id,
    storageKey: `verify-phase13/${attempt._id.toString()}.webm`,
    storageProvider: "local",
    mimeType: "video/webm",
    durationSeconds: 0,
    fileSizeBytes: 0,
    startedAt,
    endedAt: null,
    status: "RECORDING",
  });
  assert(recording.status === "RECORDING", "recording starts in RECORDING");

  const first = await finalizeAttempt(attempt, "submitted");
  assert(
    first.status === "submitted" || first.status === "expired",
    "finalize closes the attempt",
  );
  assert(first.resultId, "finalize writes resultId");

  const result = await Result.findOne({ attemptId: attempt._id });
  assert(result, "one result created");
  const resultCount = await Result.countDocuments({ attemptId: attempt._id });
  assert(resultCount === 1, "result is unique per attempt");

  const second = await finalizeAttempt(first, "submitted");
  assert(
    second.resultId?.toString() === first.resultId?.toString(),
    "second finalize is idempotent",
  );
  const resultCountAfter = await Result.countDocuments({
    attemptId: attempt._id,
  });
  assert(resultCountAfter === 1, "re-finalize does not duplicate results");

  const leftover = await ExamRecording.findById(recording._id);
  assert(
    leftover?.status === "FAILED",
    "incomplete recording is not left RECORDING after submit",
  );
  assert(leftover?.endedAt, "abandoned recording has endedAt");

  const abandoned = await abandonIncompleteRecordings(attempt._id);
  assert(abandoned === 0, "READY/FAILED recordings are not abandoned again");

  const overdue = await Attempt.create({
    studentId: student!._id,
    assessmentId: assessment!._id,
    status: "in_progress",
    startedAt: new Date(Date.now() - 120_000),
    expiresAt: new Date(Date.now() - 1000),
    durationMin: 1,
    questionIds: assessment!.questionIds,
    assessmentTitle: assessment!.title,
    totalMarks: assessment!.totalMarks,
  });
  const expired = await ensureAttemptNotExpired(overdue);
  assert(
    expired.status !== "in_progress",
    "overdue in-progress attempt is expired on server touch",
  );

  const originalSchedule = assessment!.scheduledAt;
  assessment!.scheduledAt = new Date(Date.now() + 86_400_000);
  await assessment!.save();
  let blocked = false;
  try {
    await findPublishedAssessmentForStudent(
      assessment!._id.toString(),
      student!._id.toString(),
    );
  } catch (error) {
    blocked = error instanceof ActionError;
  }
  assessment!.scheduledAt = originalSchedule;
  await assessment!.save();
  assert(blocked, "future scheduledAt cannot be started");

  await ExamRecording.deleteMany({
    attemptId: { $in: [attempt._id, overdue._id] },
  });
}

async function main() {
  await staticChecks();
  await mongoChecks();
  console.log("\nPhase 13 hardening checks passed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
