/**
 * Face detection foundation checks (server-side types + security wiring).
 * Run: npx tsx --env-file=.env.local scripts/verify-face-detection-foundation.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  buildSecuritySummary,
  FACE_EVENT_DEDUP_MS,
  isFaceObservationEvent,
  severityForEventType,
} from "../src/lib/exam/security";
import {
  normalizeAssessmentSecurity,
  DEFAULT_ASSESSMENT_SECURITY,
} from "../src/types/assessment-security";
import { Attempt } from "../src/models/Attempt";
import { SecurityEvent } from "../src/models/SecurityEvent";
import { User } from "../src/models/User";
import {
  FACE_DETECTION_INTERVAL_MS,
  FACE_EVENT_COOLDOWN_MS,
  FACE_MULTIPLE_THRESHOLD_MS,
  FACE_NO_FACE_THRESHOLD_MS,
} from "../src/lib/face/constants";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  assert(
    DEFAULT_ASSESSMENT_SECURITY.requireFaceDetection === false,
    "requireFaceDetection defaults false",
  );

  const normalized = normalizeAssessmentSecurity({
    requireCamera: false,
    requireFaceDetection: true,
    requireFullscreen: true,
    blockCopyPaste: true,
    monitorTabSwitching: true,
  });
  assert(
    normalized.requireCamera === true,
    "requireFaceDetection implies requireCamera",
  );
  assert(
    normalized.requireFaceDetection === true,
    "requireFaceDetection preserved",
  );

  assert(
    FACE_DETECTION_INTERVAL_MS === 500,
    "detection interval 500ms",
  );
  assert(FACE_NO_FACE_THRESHOLD_MS === 3000, "no-face threshold 3s");
  assert(FACE_MULTIPLE_THRESHOLD_MS === 2000, "multiple-face threshold 2s");
  assert(FACE_EVENT_COOLDOWN_MS === 5000, "event cooldown 5s");
  assert(FACE_EVENT_DEDUP_MS === 5000, "server dedup 5s");

  assert(
    severityForEventType("FACE_DETECTED") === "LOW",
    "FACE_DETECTED severity LOW",
  );
  assert(
    severityForEventType("NO_FACE_DETECTED") === "MEDIUM",
    "NO_FACE_DETECTED severity MEDIUM",
  );
  assert(
    severityForEventType("MULTIPLE_FACES_DETECTED") === "HIGH",
    "MULTIPLE_FACES severity HIGH",
  );
  assert(
    severityForEventType("FACE_DETECTION_UNAVAILABLE") === "LOW",
    "FACE_DETECTION_UNAVAILABLE severity LOW",
  );

  assert(
    isFaceObservationEvent("NO_FACE_DETECTED"),
    "NO_FACE is observation event",
  );
  assert(
    isFaceObservationEvent("MULTIPLE_FACES_DETECTED"),
    "MULTIPLE_FACES is observation event",
  );
  assert(
    !isFaceObservationEvent("FACE_DETECTED"),
    "FACE_DETECTED is not observation dedup target",
  );

  const summary = buildSecuritySummary([
    { eventType: "NO_FACE_DETECTED" },
    { eventType: "MULTIPLE_FACES_DETECTED" },
    { eventType: "FACE_DETECTED" },
    { eventType: "TAB_SWITCH" },
  ]);
  assert(summary.counts.NO_FACE_DETECTED === 1, "summary no-face count");
  assert(summary.counts.MULTIPLE_FACES_DETECTED === 1, "summary multiple count");
  assert(summary.counts.FACE_DETECTED === 1, "summary face detected count");
  assert(summary.totalViolations === 3, "face warnings count toward violations");

  await connectDB();

  const student = await User.findOne({ email: "demo@codeshield.ai" });
  assert(student, "demo student exists");

  const attempt = await Attempt.findOne({ studentId: student!._id }).sort({
    createdAt: -1,
  });

  if (!attempt) {
    console.log("SKIP: no attempt — DB persistence checks skipped");
    await mongoose.disconnect();
    return;
  }

  await SecurityEvent.deleteMany({
    attemptId: attempt._id,
    "metadata.faceTest": true,
  });

  const base = {
    attemptId: attempt._id,
    userId: student!._id,
    assessmentId: attempt.assessmentId,
    metadata: { faceTest: true, faceCount: 0, durationMs: 4200 },
    timestamp: new Date(),
  };

  await SecurityEvent.create({
    ...base,
    eventType: "NO_FACE_DETECTED",
    severity: "MEDIUM",
  });

  const stored = await SecurityEvent.findOne({
    attemptId: attempt._id,
    eventType: "NO_FACE_DETECTED",
    "metadata.faceTest": true,
  }).lean();

  assert(stored, "NO_FACE_DETECTED persisted");
  assert(
    stored!.metadata &&
      typeof stored!.metadata === "object" &&
      (stored!.metadata as { durationMs?: number }).durationMs === 4200,
    "face metadata stored without images",
  );

  await SecurityEvent.deleteMany({
    attemptId: attempt._id,
    "metadata.faceTest": true,
  });

  console.log("\nAll face detection foundation checks passed.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
