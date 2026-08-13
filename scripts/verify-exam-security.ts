/**
 * Exam security foundation checks (server-side).
 * Run: npx tsx --env-file=.env.local scripts/verify-exam-security.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  buildSecuritySummary,
  securityRiskLevelFromTotal,
  severityForEventType,
} from "../src/lib/exam/security";
import { Attempt } from "../src/models/Attempt";
import { SecurityEvent } from "../src/models/SecurityEvent";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  await connectDB();

  assert(severityForEventType("COPY_ATTEMPT") === "LOW", "copy severity LOW");
  assert(severityForEventType("TAB_SWITCH") === "MEDIUM", "tab severity MEDIUM");
  assert(securityRiskLevelFromTotal(0) === "LOW", "risk 0 = LOW");
  assert(securityRiskLevelFromTotal(3) === "MEDIUM", "risk 3 = MEDIUM");
  assert(securityRiskLevelFromTotal(6) === "HIGH", "risk 6 = HIGH");

  const student = await User.findOne({ email: "demo@codeshield.ai" });
  assert(student, "demo student exists");

  const attempt = await Attempt.findOne({
    studentId: student!._id,
  }).sort({ createdAt: -1 });

  if (!attempt) {
    console.log("SKIP: no attempt for demo student — summary unit checks only");
    const summary = buildSecuritySummary([
      { eventType: "TAB_SWITCH" },
      { eventType: "TAB_SWITCH" },
      { eventType: "COPY_ATTEMPT" },
    ]);
    assert(summary.totalViolations === 3, "summary total 3");
    assert(summary.counts.TAB_SWITCH === 2, "tab count 2");
    assert(summary.riskLevel === "MEDIUM", "summary risk MEDIUM");
    await mongoose.disconnect();
    return;
  }

  await SecurityEvent.deleteMany({
    attemptId: attempt._id,
    "metadata.test": true,
  });

  const base = {
    attemptId: attempt._id,
    userId: student!._id,
    assessmentId: attempt.assessmentId,
    metadata: { test: true },
    timestamp: new Date(),
  };

  await SecurityEvent.create({
    ...base,
    eventType: "COPY_ATTEMPT",
    severity: "LOW",
  });
  await SecurityEvent.create({
    ...base,
    eventType: "TAB_SWITCH",
    severity: "MEDIUM",
  });
  await SecurityEvent.create({
    ...base,
    eventType: "FULLSCREEN_EXIT",
    severity: "MEDIUM",
  });

  const events = await SecurityEvent.find({
    attemptId: attempt._id,
    "metadata.test": true,
  }).lean();
  assert(events.length === 3, "3 test events stored");

  const summary = buildSecuritySummary(
    events.map((e) => ({ eventType: e.eventType })),
  );
  assert(summary.counts.COPY_ATTEMPT === 1, "copy count");
  assert(summary.counts.TAB_SWITCH === 1, "tab count");
  assert(summary.counts.FULLSCREEN_EXIT === 1, "fullscreen count");
  assert(summary.totalViolations === 3, "total 3");
  assert(summary.riskLevel === "MEDIUM", "risk MEDIUM");

  // Events survive — do not delete on attempt submit simulation
  const stillThere = await SecurityEvent.countDocuments({
    attemptId: attempt._id,
    "metadata.test": true,
  });
  assert(stillThere === 3, "events retained after count");

  await SecurityEvent.deleteMany({
    attemptId: attempt._id,
    "metadata.test": true,
  });

  console.log("\nExam security foundation checks passed.");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
