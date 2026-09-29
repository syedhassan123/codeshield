/**
 * Production submit + recording lifecycle checks (no browser required).
 * Run: npx tsx --env-file=.env.local scripts/verify-production-submission-recording.ts
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { finalizeAttempt } from "../src/lib/exam/finalize";
import { getStorageProvider } from "../src/lib/storage";
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

function staticChecks() {
  assert(
    RECORDING_STATUSES.includes("RECORDING") &&
      RECORDING_STATUSES.includes("UPLOADING") &&
      RECORDING_STATUSES.includes("READY") &&
      RECORDING_STATUSES.includes("FAILED"),
    "recording status lifecycle defined",
  );

  const sessionSrc = read("src/components/exam/exam-session-client.tsx");
  assert(
    sessionSrc.includes("armRecordingFinalize()"),
    "submit arms recording finalize protection before async work",
  );
  const submitBlock = sessionSrc.slice(
    sessionSrc.indexOf("const submit = (forced = false)"),
    sessionSrc.indexOf("useEffect(() => {", sessionSrc.indexOf("const submit =")),
  );
  assert(
    submitBlock.includes("flushPendingSaves") &&
      submitBlock.indexOf("flushPendingSaves") <
        submitBlock.indexOf("submitExamAction"),
    "pending answers flush before exam submit",
  );
  assert(
    submitBlock.includes("stopRecordingForSubmit") &&
      submitBlock.includes("submitExamAction") &&
      submitBlock.indexOf("stopRecordingForSubmit") <
        submitBlock.indexOf("submitExamAction"),
    "camera recorder stops before exam submit action",
  );
  assert(
    submitBlock.includes("uploadPreparedRecording") &&
      submitBlock.indexOf("uploadPreparedRecording") <
        submitBlock.indexOf("submitExamAction"),
    "recording upload claims the row before the attempt is finalized",
  );
  assert(
    !submitBlock.includes("Promise.race") &&
      !submitBlock.includes("45_000"),
    "submit does not race recording upload against a navigation timeout",
  );
  assert(
    submitBlock.includes("setSecurityEnabled(false)") &&
      submitBlock.indexOf("setSecurityEnabled(false)") >
        submitBlock.indexOf("stopRecordingForSubmit"),
    "security/recording hook disabled only after recorder stop",
  );
  assert(
    submitBlock.includes("router.replace") &&
      submitBlock.lastIndexOf("router.replace") >
        submitBlock.lastIndexOf("uploadPreparedRecording") &&
      submitBlock.lastIndexOf("router.replace") >
        submitBlock.lastIndexOf("submitExamAction"),
    "navigation waits for recording upload and exam submit",
  );
  assert(sessionSrc.includes("isSubmitting"), "duplicate submit guard state exists");
  assert(
    sessionSrc.includes("autoSubmitted.current"),
    "submit is single-flight via autoSubmitted",
  );
  assert(
    sessionSrc.includes("describeSubmitError"),
    "submit surfaces the real error instead of a generic message only",
  );

  const hookSrc = read("src/hooks/use-exam-recording.ts");
  assert(
    hookSrc.includes("armRecordingFinalize"),
    "hook exports armRecordingFinalize",
  );
  assert(
    hookSrc.includes("stopRecordingForSubmit") &&
      hookSrc.includes("uploadPreparedRecording"),
    "hook splits recorder stop from blob upload",
  );
  assert(
    hookSrc.includes("uploadInFlightRef"),
    "concurrent recording uploads share one in-flight promise",
  );
  assert(
    hookSrc.includes("finalizeInProgressRef.current") &&
      hookSrc.includes("if (finalizeInProgressRef.current) return"),
    "unmount cleanup skipped during finalize",
  );
  assert(hookSrc.includes("uploadWithRetry"), "upload retry preserved from Phase 10");
  assert(
    hookSrc.includes('errorMessage: "Recording upload failed."'),
    "genuine upload failure is persisted as Recording upload failed.",
  );

  const browserSrc = read("src/lib/camera/browser.ts");
  assert(
    browserSrc.includes("requestData"),
    "MediaRecorder requests final chunk before stop",
  );

  const actionSrc = read("src/lib/actions/exam-recording.ts");
  assert(
    actionSrc.includes('status: { $in: ["RECORDING", "UPLOADING", "FAILED"] }') &&
      actionSrc.includes('status: "READY"'),
    "upload action claims RECORDING/UPLOADING/FAILED then READY",
  );
  assert(
    actionSrc.includes('recording.status === "READY"'),
    "upload idempotency for READY recordings",
  );

  const finalizeSrc = read("src/lib/exam/finalize.ts");
  assert(
    finalizeSrc.includes('reason === "expired"') &&
      finalizeSrc.includes("abandonIncompleteRecordings"),
    "stale recordings are abandoned only when the attempt expires",
  );

  const nextConfig = read("next.config.ts");
  assert(
    nextConfig.includes("bodySizeLimit") && nextConfig.includes("100mb"),
    "server action body limit supports large recordings",
  );
}

async function seedAttempt() {
  const student = await User.findOne({ email: "demo@codeshield.ai" });
  const assessment = await Assessment.findOne({
    status: "published",
    code: "ASM-201",
  });
  assert(student && assessment, "seed student and ASM-201 exist");

  const startedAt = new Date();
  const attempt = await Attempt.create({
    studentId: student!._id,
    assessmentId: assessment!._id,
    status: "in_progress",
    startedAt,
    expiresAt: new Date(startedAt.getTime() + 60 * 60 * 1000),
    durationMin: assessment!.durationMin,
    questionIds: assessment!.questionIds,
    assessmentTitle: assessment!.title,
    totalMarks: assessment!.totalMarks,
  });

  const questionId = assessment!.questionIds[0];
  await Answer.create({
    attemptId: attempt._id,
    questionId,
    studentId: student!._id,
    selectedOptionKey: "A",
    textAnswer: "",
  });

  return { student, assessment, attempt, questionId, startedAt };
}

async function cleanupAttempt(attemptId: mongoose.Types.ObjectId) {
  await Answer.deleteMany({ attemptId });
  await Result.deleteMany({ attemptId });
  await ExamRecording.deleteMany({ attemptId });
  await Attempt.deleteMany({ _id: attemptId });
}

async function dbChecks() {
  await connectDB();
  const storage = await getStorageProvider();

  const readyCase = await seedAttempt();
  try {
    const recording = await ExamRecording.create({
      attemptId: readyCase.attempt._id,
      userId: readyCase.student!._id,
      assessmentId: readyCase.assessment!._id,
      storageKey: `verify-submit-recording/${readyCase.attempt._id.toString()}.webm`,
      storageProvider: storage.name,
      mimeType: "video/webm",
      durationSeconds: 0,
      fileSizeBytes: 0,
      startedAt: readyCase.startedAt,
      endedAt: null,
      status: "RECORDING",
    });

    const claimed = await ExamRecording.findOneAndUpdate(
      {
        _id: recording._id,
        status: { $in: ["RECORDING", "UPLOADING", "FAILED"] },
      },
      {
        $set: {
          status: "UPLOADING",
          endedAt: new Date(),
          durationSeconds: 18,
        },
      },
      { returnDocument: "after" },
    );
    assert(claimed, "upload can claim a RECORDING row before submit");

    const body = Buffer.from("webm-fixture");
    await storage.putObject({
      key: claimed!.storageKey,
      body,
      contentType: "video/webm",
    });
    claimed!.fileSizeBytes = body.length;
    claimed!.status = "READY";
    claimed!.errorMessage = "";
    await claimed!.save();

    const submitted = await finalizeAttempt(readyCase.attempt, "submitted");
    assert(submitted.status === "submitted", "exam submit closes the attempt");
    assert(submitted.resultId, "exam submit stores a result id");

    const result = await Result.findById(submitted.resultId);
    assert(result, "backend confirms a Result document exists");
    const savedQuestion = result!.questions.find(
      (q) => q.questionId.toString() === readyCase.questionId.toString(),
    );
    assert(
      savedQuestion?.selectedOptionKey === "A",
      "submitted answers are stored on the Result",
    );

    const ready = await ExamRecording.findById(recording._id);
    assert(ready?.status === "READY", "successful recording stays READY after submit");
    assert((ready?.durationSeconds ?? 0) > 0, "READY recording stores durationSeconds");
    assert((ready?.fileSizeBytes ?? 0) > 0, "READY recording stores fileSizeBytes");
    assert(Boolean(ready?.storageKey), "READY recording keeps storageKey");
    assert(
      ready?.errorMessage !== "Attempt closed before recording upload completed.",
      "explicit submit does not write the abandon error on a READY recording",
    );

    const again = await finalizeAttempt(submitted, "submitted");
    assert(
      again.resultId?.toString() === submitted.resultId?.toString(),
      "double submit does not create a second result",
    );
    const afterDouble = await ExamRecording.findById(recording._id);
    assert(afterDouble?.status === "READY", "double submit does not reopen recording upload");
  } finally {
    await cleanupAttempt(readyCase.attempt._id);
  }

  const failCase = await seedAttempt();
  try {
    const recording = await ExamRecording.create({
      attemptId: failCase.attempt._id,
      userId: failCase.student!._id,
      assessmentId: failCase.assessment!._id,
      storageKey: `verify-submit-recording-fail/${failCase.attempt._id.toString()}.webm`,
      storageProvider: storage.name,
      mimeType: "video/webm",
      durationSeconds: 0,
      fileSizeBytes: 0,
      startedAt: failCase.startedAt,
      endedAt: new Date(),
      status: "FAILED",
      errorMessage: "Recording upload failed.",
    });

    const submitted = await finalizeAttempt(failCase.attempt, "submitted");
    assert(submitted.resultId, "exam result is created even when recording FAILED");
    const leftover = await ExamRecording.findById(recording._id);
    assert(leftover?.status === "FAILED", "genuine upload failure stays FAILED");
    assert(
      leftover?.errorMessage === "Recording upload failed.",
      "explicit submit preserves the upload failure message",
    );
  } finally {
    await cleanupAttempt(failCase.attempt._id);
  }

  const recordingOpen = await seedAttempt();
  try {
    const recording = await ExamRecording.create({
      attemptId: recordingOpen.attempt._id,
      userId: recordingOpen.student!._id,
      assessmentId: recordingOpen.assessment!._id,
      storageKey: `verify-submit-recording-open/${recordingOpen.attempt._id.toString()}.webm`,
      storageProvider: storage.name,
      mimeType: "video/webm",
      durationSeconds: 0,
      fileSizeBytes: 0,
      startedAt: recordingOpen.startedAt,
      endedAt: null,
      status: "RECORDING",
    });

    await finalizeAttempt(recordingOpen.attempt, "submitted");
    const leftover = await ExamRecording.findById(recording._id);
    assert(
      leftover?.status === "RECORDING",
      "explicit submit does not abandon a RECORDING row before client upload",
    );
    assert(
      leftover?.errorMessage !== "Attempt closed before recording upload completed.",
      "abandon error is not written on explicit submit",
    );
  } finally {
    await cleanupAttempt(recordingOpen.attempt._id);
  }

  const expiredCase = await seedAttempt();
  try {
    const recording = await ExamRecording.create({
      attemptId: expiredCase.attempt._id,
      userId: expiredCase.student!._id,
      assessmentId: expiredCase.assessment!._id,
      storageKey: `verify-submit-recording-expired/${expiredCase.attempt._id.toString()}.webm`,
      storageProvider: storage.name,
      mimeType: "video/webm",
      durationSeconds: 0,
      fileSizeBytes: 0,
      startedAt: expiredCase.startedAt,
      endedAt: null,
      status: "RECORDING",
    });

    const expired = await finalizeAttempt(expiredCase.attempt, "expired");
    assert(expired.status === "expired", "expired finalize closes the attempt");
    const leftover = await ExamRecording.findById(recording._id);
    assert(
      leftover?.status === "FAILED",
      "expired attempts still abandon incomplete recordings",
    );
    assert(
      leftover?.errorMessage === "Attempt closed before recording upload completed.",
      "stale expired recordings keep the abandon error",
    );
  } finally {
    await cleanupAttempt(expiredCase.attempt._id);
  }
}

async function main() {
  staticChecks();
  await dbChecks();
  console.log("\nProduction submit + recording lifecycle checks passed.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
