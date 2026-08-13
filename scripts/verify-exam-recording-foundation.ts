/**
 * Phase 7 foundation checks (no webcam required).
 * Run: npx tsx --env-file=.env.local scripts/verify-exam-recording-foundation.ts
 */
import {
  normalizeAssessmentSecurity,
  DEFAULT_ASSESSMENT_SECURITY,
} from "../src/types/assessment-security";
import { buildSecuritySummary } from "../src/lib/exam/security";
import { buildRecordingObjectKey } from "../src/lib/storage";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function main() {
  const legacy = normalizeAssessmentSecurity(null);
  assert(legacy.requireCamera === false, "legacy requireCamera=false");
  assert(legacy.requireFullscreen === true, "legacy requireFullscreen=true");
  assert(legacy.blockCopyPaste === true, "legacy blockCopyPaste=true");
  assert(
    legacy.monitorTabSwitching === true,
    "legacy monitorTabSwitching=true",
  );

  const custom = normalizeAssessmentSecurity({
    requireCamera: true,
    requireFullscreen: false,
    blockCopyPaste: false,
    monitorTabSwitching: false,
  });
  assert(custom.requireCamera === true, "custom requireCamera");
  assert(custom.requireFullscreen === false, "custom requireFullscreen");

  assert(
    DEFAULT_ASSESSMENT_SECURITY.requireCamera === false,
    "defaults unchanged",
  );

  const summary = buildSecuritySummary([
    { eventType: "TAB_SWITCH" },
    { eventType: "RECORDING_STARTED" },
    { eventType: "RECORDING_STOPPED" },
    { eventType: "COPY_ATTEMPT" },
  ]);
  assert(summary.totalViolations === 2, "info events excluded from risk total");
  assert(summary.riskLevel === "LOW", "risk stays LOW for 2 violations");

  const key = buildRecordingObjectKey({
    attemptId: "abc123",
    mimeType: "video/webm",
  });
  assert(key.includes("exams/abc123/"), "storage key prefix");
  assert(key.endsWith(".webm"), "webm extension");

  console.log("\nPhase 7 foundation checks passed.");
}

main();
