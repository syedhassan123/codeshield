/**
 * Phase 17 — admin proctoring review presentation.
 * Run: npx tsx scripts/verify-phase17-admin-proctoring.ts
 */
import fs from "node:fs";
import path from "node:path";
import { escapeCsvCell } from "../src/lib/admin/format";
import { analyzeProctoringAttempt } from "../src/lib/proctoring/analyze";
import {
  EYE_GAZE_PROLONGED_THRESHOLD_MS,
  EYE_GAZE_WARNING_THRESHOLD_MS,
  EYE_GAZE_HORIZONTAL_CENTER_MIN,
} from "../src/lib/face/eye-gaze-constants";
import {
  HEAD_PROLONGED_THRESHOLD_MS,
  HEAD_WARNING_THRESHOLD_MS,
} from "../src/lib/face/head-pose-constants";
import {
  buildProctoringReviewView,
  readableEventLabel,
  reviewCategoryForEvent,
  reviewRecommendation,
  timelineDetail,
} from "../src/lib/proctoring/review";
import { riskLevelFromScore } from "../src/lib/proctoring/risk";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function at(ms: number) {
  return new Date(Date.UTC(2026, 9, 31, 12, 0, 0, ms)).toISOString();
}

function main() {
  assert(HEAD_WARNING_THRESHOLD_MS === 5_000, "head warning timing unchanged");
  assert(HEAD_PROLONGED_THRESHOLD_MS === 10_000, "head prolonged timing unchanged");
  assert(EYE_GAZE_WARNING_THRESHOLD_MS === 5_000, "eye warning timing unchanged");
  assert(EYE_GAZE_PROLONGED_THRESHOLD_MS === 10_000, "eye prolonged timing unchanged");
  assert(EYE_GAZE_HORIZONTAL_CENTER_MIN === 0.35, "gaze center band unchanged");
  assert(riskLevelFromScore(24) === "LOW", "LOW threshold unchanged");
  assert(riskLevelFromScore(25) === "MEDIUM", "MEDIUM threshold unchanged");
  assert(riskLevelFromScore(50) === "HIGH", "HIGH threshold unchanged");
  assert(riskLevelFromScore(75) === "CRITICAL", "CRITICAL threshold unchanged");

  assert(reviewRecommendation("LOW") === "No immediate review needed", "low guidance");
  assert(reviewRecommendation("HIGH") === "Review recommended", "high guidance");
  assert(
    !reviewRecommendation("CRITICAL").toLowerCase().includes("cheat"),
    "recommendation does not accuse",
  );

  assert(reviewCategoryForEvent("EYE_GAZE_AWAY") === "eye", "eye category");
  assert(reviewCategoryForEvent("HEAD_LOOKING_LEFT") === "head", "head category");
  assert(reviewCategoryForEvent("NO_FACE_DETECTED") === "face", "face category");
  assert(reviewCategoryForEvent("TAB_SWITCH") === "browser", "browser category");
  assert(
    reviewCategoryForEvent("RECORDING_UPLOAD_FAILED") === "technical",
    "upload failure is technical",
  );
  assert(
    readableEventLabel("EYE_GAZE_AWAY") === "Eyes looking away",
    "eye label",
  );
  assert(
    readableEventLabel("EYE_GAZE_AWAY_PROLONGED") === "Prolonged eyes looking away",
    "prolonged eye label",
  );
  assert(readableEventLabel("") === "Security event", "missing label fallback");
  assert(readableEventLabel("not an enum") === "Security event", "legacy junk fallback");

  const empty = buildProctoringReviewView(
    analyzeProctoringAttempt({
      events: [],
      attemptStartedAt: at(0),
      recordingStartedAt: null,
    }),
  );
  assert(empty.riskScore === 0, "empty score is canonical zero");
  assert(empty.rawEventCount === 0, "empty raw count");
  assert(empty.derivedIncidentCount === 0, "empty incident count");
  assert(empty.categories.length === 0, "empty categories");

  const both = analyzeProctoringAttempt({
    events: [
      {
        id: "h1",
        eventType: "HEAD_LOOKING_LEFT",
        severity: "MEDIUM",
        timestamp: at(5_000),
        metadata: { direction: "LEFT", durationMs: 5_000 },
      },
      {
        id: "e1",
        eventType: "EYE_GAZE_AWAY",
        severity: "MEDIUM",
        timestamp: at(5_000),
        metadata: { direction: "LEFT", durationMs: 5_000, confidence: 0.74 },
      },
      {
        id: "h2",
        eventType: "PROLONGED_LOOKING_AWAY",
        severity: "HIGH",
        timestamp: at(10_000),
        metadata: { direction: "LEFT", durationMs: 10_000 },
      },
      {
        id: "e2",
        eventType: "EYE_GAZE_AWAY_PROLONGED",
        severity: "HIGH",
        timestamp: at(10_000),
        metadata: { direction: "LEFT", durationMs: 10_000, confidence: 0.74 },
      },
    ],
    attemptStartedAt: at(0),
    recordingStartedAt: null,
  });
  const view = buildProctoringReviewView(both);
  assert(both.timeline.length === 4, "raw timeline keeps all four events");
  assert(view.riskScore === both.riskScore, "review view uses canonical score");
  assert(view.corroboratedIncidents === 1, "one corroborated incident");
  assert(
    view.derivedIncidentCount === 1,
    "four correlated raw events are one derived incident",
  );
  assert(view.rawEventCount === 4, "raw event count stays 4");
  const eyeDetail = timelineDetail(both.timeline[1]);
  assert(eyeDetail.includes("Direction: Left"), "timeline shows direction");
  assert(eyeDetail.includes("Confidence: 0.74"), "timeline shows gaze confidence");
  assert(!eyeDetail.includes("landmark"), "timeline does not dump landmarks");

  const report = read("src/components/admin/admin-proctoring-analysis-report.tsx");
  assert(report.includes("buildProctoringReviewView"), "detail uses canonical review view");
  assert(!report.includes("Cheater"), "report does not label cheaters");
  assert(report.includes("Raw event timeline"), "raw timeline remains");

  const list = read("src/lib/actions/grading.ts");
  assert(list.includes("requireAdmin()"), "attempt list requires admin");
  assert(list.includes("buildProctoringReviewView"), "list risk uses canonical helper");
  assert(
    list.includes("attempt.studentId.toString() !== session.user.id"),
    "student result remains owner-checked",
  );
  assert(
    !read("src/lib/actions/grading.ts").includes("proctoringAnalysis") ||
      read("src/lib/actions/grading.ts").includes("getStudentResultDetailAction"),
    "grading module still has a separate student result action",
  );
  const studentFn = list.slice(list.indexOf("getStudentResultDetailAction"));
  assert(
    !studentFn.includes("proctoringAnalysis") && !studentFn.includes("riskScore"),
    "student result action does not return proctoring analysis",
  );

  assert(escapeCsvCell("=1+1").startsWith("'"), "csv formula protection remains");
  assert(read("src/app/layout.tsx").includes("Plus_Jakarta_Sans"), "font untouched");

  console.log("\nPhase 17 admin proctoring review checks passed.");
}

main();
