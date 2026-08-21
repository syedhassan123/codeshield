/**
 * Phase 10 proctoring hardening checks (no webcam required).
 * Run: npx tsx --env-file=.env.local scripts/verify-phase10-proctoring.ts
 */
import {
  DEFAULT_ASSESSMENT_SECURITY,
  normalizeAssessmentSecurity,
} from "../src/types/assessment-security";
import {
  isGetUserMediaSupported,
  isMediaRecorderSupported,
  pickSupportedRecorderMimeType,
} from "../src/lib/camera/browser";
import { RECORDING_STATUSES } from "../src/types/exam-recording";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function main() {
  const noCamera = normalizeAssessmentSecurity({
    requireCamera: false,
    requireFaceDetection: false,
    requireHeadMonitoring: false,
  });
  assert(noCamera.requireCamera === false, "requireCamera=false stays false");
  assert(
    noCamera.requireFaceDetection === false,
    "face detection off when camera off",
  );

  const withFace = normalizeAssessmentSecurity({
    requireCamera: false,
    requireFaceDetection: true,
  });
  assert(withFace.requireCamera === true, "face detection forces camera");

  assert(
    DEFAULT_ASSESSMENT_SECURITY.requireCamera === false,
    "default camera optional",
  );

  assert(Array.isArray(RECORDING_STATUSES), "recording statuses defined");
  assert(
    RECORDING_STATUSES.includes("RECORDING") &&
      RECORDING_STATUSES.includes("UPLOADING") &&
      RECORDING_STATUSES.includes("READY") &&
      RECORDING_STATUSES.includes("FAILED"),
    "recording lifecycle statuses present",
  );

  assert(typeof isGetUserMediaSupported === "function", "camera support helper");
  assert(
    typeof isMediaRecorderSupported === "function",
    "mediarecorder support helper",
  );
  assert(typeof pickSupportedRecorderMimeType === "function", "mime helper");

  console.log("\nPhase 10 proctoring checks passed.");
}

main();
