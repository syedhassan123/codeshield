/**
 * Phase 16 — evidence, risk, and reporting checks (no webcam, no database).
 * Run: npx tsx scripts/verify-phase16-proctoring-evidence.ts
 */
import fs from "node:fs";
import path from "node:path";
import { escapeCsvCell } from "../src/lib/admin/format";
import { sanitizeSecurityEventMetadata } from "../src/lib/exam/security";
import { analyzeProctoringAttempt } from "../src/lib/proctoring/analyze";
import { labelForEvent } from "../src/lib/proctoring/evidence";
import {
  ATTENTION_CORRELATION_WINDOW_MS,
  calculateRiskScore,
  correlateHeadEyeAttention,
} from "../src/lib/proctoring/risk";
import { SECURITY_EVENT_TYPES } from "../src/types/exam-security";
import {
  EYE_GAZE_PROLONGED_THRESHOLD_MS,
  EYE_GAZE_WARNING_THRESHOLD_MS,
} from "../src/lib/face/eye-gaze-constants";
import {
  HEAD_PROLONGED_THRESHOLD_MS,
  HEAD_WARNING_THRESHOLD_MS,
} from "../src/lib/face/head-pose-constants";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

type Ev = {
  id: string;
  eventType: string;
  severity: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

function at(ms: number): string {
  return new Date(Date.UTC(2026, 9, 31, 10, 0, 0, ms)).toISOString();
}

function ev(
  id: string,
  eventType: string,
  offsetMs: number,
  metadata: Record<string, unknown> = {},
): Ev {
  return {
    id,
    eventType,
    severity: "MEDIUM",
    timestamp: at(offsetMs),
    metadata,
  };
}

function scoreOf(events: Ev[]) {
  return analyzeProctoringAttempt({
    events,
    attemptStartedAt: at(0),
    recordingStartedAt: null,
  });
}

function main() {
  assert(
    HEAD_WARNING_THRESHOLD_MS === 5_000 && HEAD_PROLONGED_THRESHOLD_MS === 10_000,
    "head warning timing unchanged",
  );
  assert(
    EYE_GAZE_WARNING_THRESHOLD_MS === 5_000 &&
      EYE_GAZE_PROLONGED_THRESHOLD_MS === 10_000,
    "eye warning timing unchanged",
  );
  assert(ATTENTION_CORRELATION_WINDOW_MS === 20_000, "attention window is 20s");

  for (const type of [
    "EYE_GAZE_AWAY",
    "EYE_GAZE_AWAY_PROLONGED",
    "HEAD_LOOKING_LEFT",
    "PROLONGED_LOOKING_AWAY",
    "TAB_SWITCH",
    "FULLSCREEN_EXIT",
    "PASTE_ATTEMPT",
    "NO_FACE_DETECTED",
    "MULTIPLE_FACES_DETECTED",
  ]) {
    assert(
      (SECURITY_EVENT_TYPES as readonly string[]).includes(type),
      `${type} is an accepted event type`,
    );
  }

  assert(
    labelForEvent("EYE_GAZE_AWAY") === "Eyes looking away",
    "eye away label is human-readable",
  );
  assert(
    labelForEvent("EYE_GAZE_AWAY_PROLONGED") === "Prolonged eyes looking away",
    "prolonged eye label is human-readable",
  );
  assert(
    !labelForEvent("EYE_GAZE_AWAY").toLowerCase().includes("cheat"),
    "eye label does not accuse",
  );

  const clean = scoreOf([]);
  assert(clean.riskScore === 0 && clean.riskLevel === "LOW", "clean attempt is low");

  const eyeOnly = scoreOf([
    ev("e1", "EYE_GAZE_AWAY", 5_000, { direction: "LEFT", durationMs: 5_000, confidence: 0.9 }),
  ]);
  assert(eyeOnly.riskLevel === "LOW", "single eye event stays low");
  assert(eyeOnly.riskScore > 0 && eyeOnly.riskScore < 15, "eye-only score is conservative");

  const headOnly = scoreOf([
    ev("h1", "HEAD_LOOKING_LEFT", 5_000, { direction: "LEFT", durationMs: 5_000 }),
    ev("h2", "PROLONGED_LOOKING_AWAY", 10_000, { direction: "LEFT", durationMs: 10_000 }),
  ]);

  const both = scoreOf([
    ev("h1", "HEAD_LOOKING_LEFT", 5_000, { direction: "LEFT", durationMs: 5_000 }),
    ev("e1", "EYE_GAZE_AWAY", 5_000, { direction: "LEFT", durationMs: 5_000, confidence: 0.9 }),
    ev("h2", "PROLONGED_LOOKING_AWAY", 10_000, { direction: "LEFT", durationMs: 10_000 }),
    ev("e2", "EYE_GAZE_AWAY_PROLONGED", 10_000, {
      direction: "LEFT",
      durationMs: 10_000,
      confidence: 0.9,
    }),
  ]);

  const linear = calculateRiskScore(both.timeline, []);
  assert(both.timeline.length === 4, "raw head+eye events stay on the timeline");
  assert(both.riskScore > eyeOnly.riskScore, "head+eye is stronger than eye alone");
  assert(both.riskScore > headOnly.riskScore, "corroboration adds confidence, not a zero");
  assert(
    both.riskScore < headOnly.riskScore + eyeOnly.riskScore + 20,
    "head+eye is not a linear stack of every threshold",
  );
  assert(linear <= 100, "risk score is capped at 100");

  const correlated = correlateHeadEyeAttention(both.timeline);
  assert(correlated.corroborationCount === 1, "one attention window for the same episode");
  assert(correlated.suppressedEyeIds.size === 2, "both eye events are folded into that window");

  const episodes = scoreOf([
    ev("e1", "EYE_GAZE_AWAY", 5_000, { durationMs: 5_000, confidence: 0.8 }),
    ev("e2", "EYE_GAZE_AWAY", 120_000, { durationMs: 5_000, confidence: 0.8 }),
  ]);
  const episodeCorr = correlateHeadEyeAttention(episodes.timeline);
  assert(episodeCorr.corroborationCount === 0, "eye-only episodes are not head-corroborated");
  assert(
    episodes.evidenceCounts.EYE_GAZE_AWAY === 2,
    "two separate away episodes remain two events",
  );

  const mixed = scoreOf([
    ev("e1", "EYE_GAZE_AWAY", 5_000, { durationMs: 5_000 }),
    ev("t1", "TAB_SWITCH", 6_000, {}),
    ev("f1", "FULLSCREEN_EXIT", 7_000, {}),
  ]);
  assert(mixed.evidenceCounts.TAB_SWITCH === 1, "tab stays its own evidence");
  assert(mixed.evidenceCounts.FULLSCREEN_EXIT === 1, "fullscreen stays its own evidence");
  assert(mixed.evidenceCounts.EYE_GAZE_AWAY === 1, "gaze is not merged into browser events");
  assert(
    correlateHeadEyeAttention(mixed.timeline).suppressedEyeIds.size === 0,
    "tab/fullscreen do not suppress gaze scoring",
  );

  const disagree = scoreOf([
    ev("h1", "HEAD_LOOKING_LEFT", 5_000, { direction: "LEFT", durationMs: 5_000 }),
    ev("e1", "EYE_GAZE_AWAY", 5_000, { direction: "RIGHT", durationMs: 5_000 }),
  ]);
  assert(
    correlateHeadEyeAttention(disagree.timeline).corroborationCount === 0,
    "opposite head and eye directions are not treated as one incident",
  );

  const flooded = Array.from({ length: 40 }, (_, i) =>
    ev(`x${i}`, "EYE_GAZE_AWAY", 5_000, { durationMs: 5_000 }),
  );
  const floodScore = scoreOf(flooded).riskScore;
  assert(floodScore <= 100, "repeated samples cannot exceed 100");

  const meta = sanitizeSecurityEventMetadata({
    direction: "LEFT",
    durationMs: 5000,
    confidence: 0.8,
    headOrientation: "NORMAL",
    headYaw: 2,
    headPitch: 1,
    landmarks: [{ x: 0.1, y: 0.2 }],
    iris: { x: 1, y: 2 },
    screenshot: "data:image/png;base64,aaaa",
    token: "secret",
    nested: { a: 1 },
  });
  assert(meta.direction === "LEFT", "derived direction kept");
  assert(meta.durationMs === 5000, "derived duration kept");
  assert(!("landmarks" in meta), "landmarks dropped");
  assert(!("iris" in meta), "iris dropped");
  assert(!("screenshot" in meta), "screenshot dropped");
  assert(!("token" in meta), "token dropped");
  assert(!("nested" in meta), "nested objects dropped");

  assert(escapeCsvCell("=1+1").startsWith("'"), "csv formula prefix preserved");
  assert(escapeCsvCell("+cmd").startsWith("'"), "csv plus prefix preserved");
  assert(escapeCsvCell("-1").startsWith("'"), "csv minus prefix preserved");
  assert(escapeCsvCell("@SUM").startsWith("'"), "csv at prefix preserved");
  assert(escapeCsvCell("|pipe").startsWith("'"), "csv pipe prefix preserved");

  const action = read("src/lib/actions/exam-security.ts");
  assert(action.includes("requireStudent"), "event writes require a student session");
  assert(action.includes("getOwnedAttempt"), "event writes check attempt ownership");
  assert(action.includes("z.enum(SECURITY_EVENT_TYPES)"), "event type is whitelisted");
  assert(action.includes("sanitizeSecurityEventMetadata"), "metadata is sanitized");
  assert(action.includes("severityForEventType"), "severity is server-derived");
  assert(action.includes(".limit(1000)"), "attempt event query is bounded");

  const report = read("src/lib/actions/exam-security.ts");
  assert(report.includes("requireAdmin"), "security report requires admin");

  const student = read("src/lib/actions/grading.ts");
  assert(
    student.includes("attempt.studentId.toString() !== session.user.id"),
    "student result read is owner-checked",
  );

  const gazeConsts = read("src/lib/face/eye-gaze-constants.ts");
  assert(
    gazeConsts.includes("EYE_GAZE_HORIZONTAL_CENTER_MIN = 0.35"),
    "gaze center band not recalibrated",
  );

  const layout = read("src/app/layout.tsx");
  assert(layout.includes("Plus_Jakarta_Sans"), "font configuration untouched");

  console.log("\nPhase 16 proctoring evidence checks passed.");
}

main();
