/**
 * Head pose monitoring foundation checks.
 * Run: npx tsx --env-file=.env.local scripts/verify-head-pose-monitoring.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  buildSecuritySummary,
  HEAD_EVENT_DEDUP_MS,
  isHeadObservationEvent,
  severityForEventType,
} from "../src/lib/exam/security";
import {
  classifyHeadOrientation,
  orientationToEventType,
} from "../src/lib/face/head-pose-orientation";
import {
  HEAD_PROLONGED_THRESHOLD_MS,
  HEAD_REPEATED_EPISODE_COUNT,
  HEAD_REPEATED_WINDOW_MS,
  HEAD_WARNING_THRESHOLD_MS,
  MIN_SIGNIFICANT_HEAD_ANGLE_DEG,
} from "../src/lib/face/head-pose-constants";
import {
  DEFAULT_ASSESSMENT_SECURITY,
  normalizeAssessmentSecurity,
} from "../src/types/assessment-security";
import { Attempt } from "../src/models/Attempt";
import { SecurityEvent } from "../src/models/SecurityEvent";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  assert(
    DEFAULT_ASSESSMENT_SECURITY.requireHeadMonitoring === false,
    "requireHeadMonitoring defaults false",
  );

  const normalized = normalizeAssessmentSecurity({
    requireCamera: false,
    requireFaceDetection: false,
    requireHeadMonitoring: true,
    requireFullscreen: true,
    blockCopyPaste: true,
    monitorTabSwitching: true,
  });
  assert(normalized.requireCamera === true, "head monitoring implies camera");
  assert(
    normalized.requireFaceDetection === true,
    "head monitoring implies face detection",
  );
  assert(
    normalized.requireHeadMonitoring === true,
    "requireHeadMonitoring preserved",
  );

  assert(
    MIN_SIGNIFICANT_HEAD_ANGLE_DEG === 25,
    "min significant angle 25 deg",
  );
  assert(HEAD_WARNING_THRESHOLD_MS === 20_000, "warning threshold 20s");
  assert(HEAD_PROLONGED_THRESHOLD_MS === 30_000, "prolonged threshold 30s");
  assert(HEAD_REPEATED_EPISODE_COUNT === 3, "repeated episode count 3");
  assert(HEAD_REPEATED_WINDOW_MS === 300_000, "repeated window 5 min");
  assert(HEAD_EVENT_DEDUP_MS === 5000, "server dedup 5s");

  assert(
    classifyHeadOrientation({ yaw: 10, pitch: 5, roll: 0 }) === "NORMAL",
    "small movement is NORMAL",
  );
  assert(
    classifyHeadOrientation({ yaw: 30, pitch: 5, roll: 0 }) === "RIGHT",
    "yaw right classified",
  );
  assert(
    classifyHeadOrientation({ yaw: -30, pitch: 5, roll: 0 }) === "LEFT",
    "yaw left classified",
  );
  assert(
    classifyHeadOrientation({ yaw: 5, pitch: -30, roll: 0 }) === "UP",
    "pitch up classified",
  );
  assert(
    classifyHeadOrientation({ yaw: 5, pitch: 30, roll: 0 }) === "DOWN",
    "pitch down classified",
  );
  assert(
    orientationToEventType("LEFT") === "HEAD_LOOKING_LEFT",
    "LEFT maps to event type",
  );

  assert(
    severityForEventType("HEAD_LOOKING_LEFT") === "MEDIUM",
    "HEAD_LOOKING severity MEDIUM",
  );
  assert(
    severityForEventType("PROLONGED_LOOKING_AWAY") === "HIGH",
    "PROLONGED severity HIGH",
  );
  assert(
    severityForEventType("REPEATED_LOOKING_AWAY") === "HIGH",
    "REPEATED severity HIGH",
  );
  assert(
    isHeadObservationEvent("HEAD_LOOKING_RIGHT"),
    "HEAD_LOOKING is head observation",
  );

  const summary = buildSecuritySummary([
    { eventType: "HEAD_LOOKING_LEFT" },
    { eventType: "PROLONGED_LOOKING_AWAY" },
    { eventType: "REPEATED_LOOKING_AWAY" },
    { eventType: "FACE_DETECTED" },
  ]);
  assert(summary.counts.HEAD_LOOKING_LEFT === 1, "summary head left count");
  assert(summary.totalViolations === 3, "head observations count as violations");

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
    "metadata.headTest": true,
  });

  await SecurityEvent.create({
    attemptId: attempt._id,
    userId: student!._id,
    assessmentId: attempt.assessmentId,
    eventType: "HEAD_LOOKING_LEFT",
    severity: "MEDIUM",
    timestamp: new Date(),
    metadata: { headTest: true, direction: "LEFT", durationMs: 22_400 },
  });

  const stored = await SecurityEvent.findOne({
    attemptId: attempt._id,
    eventType: "HEAD_LOOKING_LEFT",
    "metadata.headTest": true,
  }).lean();

  assert(stored, "HEAD_LOOKING_LEFT persisted");
  assert(
    stored!.metadata &&
      typeof stored!.metadata === "object" &&
      (stored!.metadata as { durationMs?: number }).durationMs === 22_400,
    "head metadata stored without images",
  );

  await SecurityEvent.deleteMany({
    attemptId: attempt._id,
    "metadata.headTest": true,
  });

  console.log("\nAll head pose monitoring checks passed.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
