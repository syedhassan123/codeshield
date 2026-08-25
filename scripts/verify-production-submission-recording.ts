/**
 * Production submit + recording lifecycle checks (no browser required).
 * Run: npx tsx --env-file=.env.local scripts/verify-production-submission-recording.ts
 */
import fs from "node:fs";
import path from "node:path";
import { RECORDING_STATUSES } from "../src/types/exam-recording";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function main() {
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
    submitBlock.includes("finalizeAfterSubmit") &&
      submitBlock.includes("submitExamAction") &&
      submitBlock.indexOf("finalizeAfterSubmit") <
        submitBlock.indexOf("submitExamAction"),
    "recording finalizes before exam submit action",
  );
  assert(
    submitBlock.includes("setSecurityEnabled(false)") &&
      submitBlock.indexOf("setSecurityEnabled(false)") >
        submitBlock.indexOf("finalizeAfterSubmit"),
    "security/recording hook disabled only after recording finalize",
  );
  assert(
    !submitBlock.includes("!recording.success"),
    "recording finalize failure does not abort exam submit",
  );
  assert(
    submitBlock.includes("router.replace") &&
      submitBlock.lastIndexOf("router.replace") >
        submitBlock.lastIndexOf("finalizeAfterSubmit"),
    "navigation happens after recording finalize",
  );
  assert(sessionSrc.includes("isSubmitting"), "duplicate submit guard state exists");

  const hookSrc = read("src/hooks/use-exam-recording.ts");
  assert(
    hookSrc.includes("armRecordingFinalize"),
    "hook exports armRecordingFinalize",
  );
  assert(
    hookSrc.includes("finalizeInProgressRef.current") &&
      hookSrc.includes("if (finalizeInProgressRef.current) return"),
    "unmount cleanup skipped during finalize",
  );
  assert(hookSrc.includes("uploadWithRetry"), "upload retry preserved from Phase 10");

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

  console.log("\nProduction submit + recording lifecycle checks passed.");
}

main();
