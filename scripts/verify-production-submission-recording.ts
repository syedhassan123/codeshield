/**
 * Production submit + recording lifecycle checks (no browser required).
 * Run: npx tsx --env-file=.env.local scripts/verify-production-submission-recording.ts
 */
import fs from "node:fs";
import path from "node:path";
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
      submitBlock.indexOf("submitExamAction") <
        submitBlock.indexOf("uploadPreparedRecording"),
    "recording upload happens after answers are submitted",
  );
  assert(
    submitBlock.includes("setSecurityEnabled(false)") &&
      submitBlock.indexOf("setSecurityEnabled(false)") >
        submitBlock.indexOf("stopRecordingForSubmit"),
    "security/recording hook disabled only after recorder stop",
  );
  assert(
    !submitBlock.includes("!recording.success"),
    "recording finalize failure does not abort exam submit",
  );
  assert(
    submitBlock.includes("router.replace") &&
      submitBlock.lastIndexOf("router.replace") >
        submitBlock.lastIndexOf("submitExamAction"),
    "navigation happens after exam submit",
  );
  assert(sessionSrc.includes("isSubmitting"), "duplicate submit guard state exists");
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
    hookSrc.includes("finalizeInProgressRef.current") &&
      hookSrc.includes("if (finalizeInProgressRef.current) return"),
    "unmount cleanup skipped during finalize",
  );
  assert(hookSrc.includes("uploadWithRetry"), "upload retry preserved from Phase 10");
  assert(
    hookSrc.includes("try {") && hookSrc.includes("uploadExamRecordingAction"),
    "recording upload catches thrown server-action failures",
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

  const nextConfig = read("next.config.ts");
  assert(
    nextConfig.includes("bodySizeLimit") && nextConfig.includes("100mb"),
    "server action body limit supports large recordings",
  );
}

async function dbChecks() {
  await connectDB();

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

  const recording = await ExamRecording.create({
    attemptId: attempt._id,
    userId: student!._id,
    assessmentId: assessment!._id,
    storageKey: `verify-submit-recording/${attempt._id.toString()}.webm`,
    storageProvider: "local",
    mimeType: "video/webm",
    durationSeconds: 12,
    fileSizeBytes: 0,
    startedAt,
    endedAt: null,
    status: "RECORDING",
  });

  try {
    const submitted = await finalizeAttempt(attempt, "submitted");
    assert(submitted.status === "submitted", "exam submit closes the attempt");
    assert(submitted.resultId, "exam submit stores a result id");

    const result = await Result.findById(submitted.resultId);
    assert(result, "backend confirms a Result document exists");
    const savedQuestion = result!.questions.find(
      (q) => q.questionId.toString() === questionId.toString(),
    );
    assert(
      savedQuestion?.selectedOptionKey === "A",
      "submitted answers are stored on the Result",
    );

    const again = await finalizeAttempt(submitted, "submitted");
    assert(
      again.resultId?.toString() === submitted.resultId?.toString(),
      "double submit does not create a second result",
    );

    const leftover = await ExamRecording.findById(recording._id);
    assert(
      leftover?.status === "FAILED",
      "incomplete recording is failed when the attempt is closed",
    );

    const claimed = await ExamRecording.findOneAndUpdate(
      {
        _id: recording._id,
        userId: student!._id,
        status: { $in: ["RECORDING", "UPLOADING", "FAILED"] },
      },
      {
        $set: {
          status: "UPLOADING",
          endedAt: new Date(),
          durationSeconds: 12,
        },
      },
      { returnDocument: "after" },
    );
    assert(claimed, "post-submit upload can still claim a FAILED recording");

    const storage = await getStorageProvider();
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

    const ready = await ExamRecording.findById(recording._id);
    assert(ready?.status === "READY", "recording reaches READY after late upload");
    assert(
      (ready?.fileSizeBytes ?? 0) > 0,
      "late upload stores recording bytes",
    );
  } finally {
    await Answer.deleteMany({ attemptId: attempt._id });
    await Result.deleteMany({ attemptId: attempt._id });
    await ExamRecording.deleteMany({ attemptId: attempt._id });
    await Attempt.deleteMany({ _id: attempt._id });
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
