/**
 * Phase 11 AI proctoring analysis checks (no webcam required).
 * Run: npx tsx scripts/verify-phase11-ai-proctoring.ts
 */
import { analyzeProctoringAttempt } from "../src/lib/proctoring/analyze";
import { findTemporalCorrelations } from "../src/lib/proctoring/correlation";
import {
  buildEvidenceTimeline,
  extractConfidence,
  formatRecordingOffset,
  recordingOffsetSeconds,
} from "../src/lib/proctoring/evidence";
import {
  buildRiskFactors,
  calculateRiskScore,
  riskLevelFromScore,
} from "../src/lib/proctoring/risk";
import { buildProctoringReviewSummary } from "../src/lib/proctoring/summary";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function main() {
  const attemptStartedAt = "2026-08-21T10:00:00.000Z";
  const recordingStartedAt = "2026-08-21T10:00:05.000Z";

  const events = [
    {
      id: "1",
      eventType: "TAB_SWITCH",
      severity: "MEDIUM",
      timestamp: "2026-08-21T10:42:10.000Z",
      metadata: { source: "visibilitychange" },
    },
    {
      id: "2",
      eventType: "NO_FACE_DETECTED",
      severity: "MEDIUM",
      timestamp: "2026-08-21T10:42:14.000Z",
      metadata: { durationMs: 8000, confidence: 0.91, faceCount: 0 },
    },
    {
      id: "3",
      eventType: "HEAD_LOOKING_RIGHT",
      severity: "MEDIUM",
      timestamp: "2026-08-21T10:42:17.000Z",
      metadata: { durationMs: 12000, direction: "RIGHT" },
    },
    {
      id: "4",
      eventType: "MULTIPLE_FACES_DETECTED",
      severity: "HIGH",
      timestamp: "2026-08-21T10:48:21.000Z",
      metadata: { durationMs: 5000, faceCount: 2, confidence: 0.96 },
    },
    {
      id: "5",
      eventType: "FULLSCREEN_EXIT",
      severity: "MEDIUM",
      timestamp: "2026-08-21T10:48:24.000Z",
      metadata: {},
    },
  ];

  const timeline = buildEvidenceTimeline({
    events,
    attemptStartedAt,
    recordingStartedAt,
  });
  assert(timeline.length === 5, "timeline includes all events");

  const offset = recordingOffsetSeconds(
    events[0].timestamp,
    recordingStartedAt,
  );
  assert(offset === 2525, "recording offset computed");
  assert(formatRecordingOffset(125) === "02:05", "recording offset formatted");

  assert(
    extractConfidence({ confidence: 0.96 }) === 0.96,
    "confidence extracted when present",
  );
  assert(
    extractConfidence({ durationMs: 4000 }) != null,
    "duration-derived confidence when score absent",
  );

  const correlations = findTemporalCorrelations(timeline);
  assert(correlations.length >= 1, "temporal correlation cluster detected");

  const factors = buildRiskFactors(timeline);
  assert(factors.length >= 3, "risk factors generated");

  const score = calculateRiskScore(timeline, correlations);
  assert(score > 0 && score <= 100, "risk score bounded 0-100");
  assert(riskLevelFromScore(score) !== "LOW", "correlated attempt not LOW risk");

  const analysis = analyzeProctoringAttempt({
    events,
    attemptStartedAt,
    recordingStartedAt,
  });
  assert(analysis.riskScore === score, "analyzeProctoringAttempt score matches");
  assert(analysis.timeline.length === 5, "analysis timeline populated");
  assert(analysis.summary.keyEvents.length > 0, "summary key events populated");
  assert(
    !analysis.summary.summary.toLowerCase().includes("cheated"),
    "summary avoids cheating accusations",
  );
  assert(
    analysis.summary.disclaimer.length > 20,
    "summary includes disclaimer",
  );

  const low = analyzeProctoringAttempt({
    events: [],
    attemptStartedAt,
    recordingStartedAt: null,
  });
  assert(low.riskLevel === "LOW", "empty attempt is LOW risk");
  assert(low.riskScore === 0, "empty attempt score is zero");

  const summary = buildProctoringReviewSummary({
    riskScore: analysis.riskScore,
    riskLevel: analysis.riskLevel,
    riskFactors: analysis.riskFactors,
    correlations: analysis.correlations,
    attemptDurationMinutes: 50,
  });
  assert(summary.recommendedReviewPoints.length > 0, "review points generated");

  console.log("\nPhase 11 AI proctoring checks passed.");
}

main();
