/**
 * Phase 19 — admin proctoring review decisions.
 * Run: npx tsx scripts/verify-phase19-proctoring-review.ts
 */
import fs from "node:fs";
import path from "node:path";
import { proctoringCaseReviewSchema } from "../src/lib/validators/grading";
import {
  applyProctoringReview,
  presentProctoringCaseReview,
  REVIEW_CONFLICT_MESSAGE,
} from "../src/lib/proctoring/case-review";
import {
  ATTENTION_CORRELATION_WINDOW_MS,
  riskLevelFromScore,
} from "../src/lib/proctoring/risk";
import {
  queryProctoringReview,
  scoreReviewAttempt,
} from "../src/lib/proctoring/global-analytics";
import {
  EYE_GAZE_WARNING_THRESHOLD_MS,
} from "../src/lib/face/eye-gaze-constants";
import { HEAD_WARNING_THRESHOLD_MS } from "../src/lib/face/head-pose-constants";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function at(ms: number) {
  return new Date(Date.UTC(2026, 0, 1, 12, 0, 0, ms)).toISOString();
}

function scored(input: {
  id: string;
  levelEvents: Array<{ type: string; count: number }>;
  decision?: "CLEARED" | "FLAGGED" | "NEEDS_FOLLOW_UP" | null;
  reviewerName?: string | null;
}) {
  const events = input.levelEvents.flatMap((group) =>
    Array.from({ length: group.count }, (_, index) => ({
      id: `${input.id}-${group.type}-${index}`,
      eventType: group.type,
      severity: "MEDIUM",
      timestamp: at(index * 1_000),
      metadata: {},
    })),
  );
  return scoreReviewAttempt({
    id: input.id,
    studentName: input.id,
    studentEmail: `${input.id}@example.com`,
    assessmentId: "assess-a",
    assessmentTitle: "Alpha",
    status: "submitted",
    completedAt: at(0),
    startedAt: at(0),
    events,
    reviewDecision: input.decision ?? null,
    reviewerName: input.reviewerName ?? null,
  });
}

function main() {
  assert(HEAD_WARNING_THRESHOLD_MS === 5_000, "head warning timing unchanged");
  assert(EYE_GAZE_WARNING_THRESHOLD_MS === 5_000, "eye warning timing unchanged");
  assert(ATTENTION_CORRELATION_WINDOW_MS === 20_000, "correlation window unchanged");
  assert(riskLevelFromScore(24) === "LOW", "LOW threshold unchanged");
  assert(riskLevelFromScore(75) === "CRITICAL", "CRITICAL threshold unchanged");
  const riskSource = read("src/lib/proctoring/risk.ts");
  assert(riskSource.includes("EYE_GAZE_AWAY: 2"), "eye weight unchanged");
  assert(riskSource.includes("Math.min(100"), "score cap unchanged");

  const legacy = presentProctoringCaseReview(null, new Map());
  assert(legacy.status === "UNREVIEWED", "missing review is unreviewed");
  assert(legacy.decision === null, "missing review is not cleared");
  assert(legacy.decisionLabel === "Not reviewed yet", "empty state copy");
  assert(legacy.version === 0, "unreviewed version is zero");

  const events = [
    {
      id: "face",
      eventType: "MULTIPLE_FACES_DETECTED",
      severity: "HIGH",
      timestamp: at(1_000),
      metadata: {},
    },
  ];
  const before = scoreReviewAttempt({
    id: "risk-lock",
    studentName: "Sam",
    studentEmail: "sam@example.com",
    assessmentId: "assess-a",
    assessmentTitle: "Alpha",
    status: "submitted",
    completedAt: at(0),
    startedAt: at(0),
    events,
  });
  const created = applyProctoringReview(null, {
    attemptId: "risk-lock",
    expectedVersion: 0,
    decision: "CLEARED",
    note: "  looks consistent  ",
    reviewerId: "admin-a",
    reviewedAt: "2026-10-31T00:00:00.000Z",
  });
  assert(created.ok && !created.unchanged, "admin can clear an attempt");
  if (!created.ok) return;
  assert(created.record.note === "looks consistent", "note is trimmed");
  assert(created.record.reviewerId === "admin-a", "stored reviewer is the supplied server id");
  assert(
    created.record.reviewedAt === "2026-10-31T00:00:00.000Z",
    "stored time is the server-supplied timestamp",
  );
  assert(created.record.version === 1, "first review is version 1");
  assert(created.record.history.length === 0, "first review has no prior history");
  const after = scoreReviewAttempt({
    id: "risk-lock",
    studentName: "Sam",
    studentEmail: "sam@example.com",
    assessmentId: "assess-a",
    assessmentTitle: "Alpha",
    status: "submitted",
    completedAt: at(0),
    startedAt: at(0),
    events,
    reviewDecision: "CLEARED",
  });
  assert(after.riskScore === before.riskScore, "risk score unchanged by a clear decision");
  assert(after.riskLevel === before.riskLevel, "risk level unchanged by a clear decision");
  assert(events.length === 1, "review does not change the event list");

  const repeat = applyProctoringReview(created.record, {
    attemptId: "risk-lock",
    expectedVersion: 1,
    decision: "CLEARED",
    note: "looks consistent",
    reviewerId: "admin-a",
    reviewedAt: "2026-11-01T00:00:00.000Z",
  });
  assert(repeat.ok && repeat.unchanged, "identical resubmit does not add history");
  if (!repeat.ok) return;
  assert(repeat.record.version === 1, "identical resubmit keeps the version");
  assert(repeat.record.history.length === 0, "identical resubmit keeps history empty");

  const flagged = applyProctoringReview(created.record, {
    attemptId: "risk-lock",
    expectedVersion: 1,
    decision: "FLAGGED",
    note: "second look",
    reviewerId: "admin-b",
    reviewedAt: "2026-11-02T00:00:00.000Z",
  });
  assert(flagged.ok && !flagged.unchanged, "decision can be changed");
  if (!flagged.ok) return;
  assert(flagged.record.version === 2, "change increments version");
  assert(flagged.record.decision === "FLAGGED", "latest decision is flagged");
  assert(flagged.record.history.length === 1, "previous decision is kept");
  assert(flagged.record.history[0]?.decision === "CLEARED", "history keeps the cleared decision");
  assert(flagged.record.history[0]?.reviewerId === "admin-a", "history keeps the first reviewer");

  const followUp = applyProctoringReview(flagged.record, {
    attemptId: "risk-lock",
    expectedVersion: 2,
    decision: "NEEDS_FOLLOW_UP",
    note: "",
    reviewerId: "admin-b",
    reviewedAt: "2026-11-03T00:00:00.000Z",
  });
  assert(followUp.ok && followUp.record.decision === "NEEDS_FOLLOW_UP", "follow-up is accepted");

  const stale = applyProctoringReview(created.record, {
    attemptId: "risk-lock",
    expectedVersion: 0,
    decision: "FLAGGED",
    note: "from a stale screen",
    reviewerId: "admin-b",
    reviewedAt: "2026-11-02T00:00:00.000Z",
  });
  assert(!stale.ok, "stale version cannot overwrite");
  assert(REVIEW_CONFLICT_MESSAGE.includes("Refresh and try again."), "conflict copy");

  const parsed = proctoringCaseReviewSchema.parse({
    attemptId: "attempt-1",
    decision: "CLEARED",
    note: "internal",
    expectedVersion: 0,
    reviewerId: "spoofed-admin",
    reviewedAt: "1999-01-01T00:00:00.000Z",
  });
  assert(!("reviewerId" in parsed), "client reviewer id is stripped");
  assert(!("reviewedAt" in parsed), "client timestamp is stripped");
  let rejected = false;
  try {
    proctoringCaseReviewSchema.parse({
      attemptId: "attempt-1",
      decision: "GUILTY",
      note: "",
      expectedVersion: 0,
    });
  } catch {
    rejected = true;
  }
  assert(rejected, "arbitrary decision strings are rejected");

  const openCritical = scored({
    id: "open-critical",
    levelEvents: [{ type: "MULTIPLE_FACES_DETECTED", count: 5 }],
  });
  const clearedCritical = scored({
    id: "cleared-critical",
    levelEvents: [{ type: "MULTIPLE_FACES_DETECTED", count: 5 }],
    decision: "CLEARED",
    reviewerName: "Ada Admin",
  });
  const flaggedHigh = scored({
    id: "flagged-high",
    levelEvents: [{ type: "TAB_SWITCH", count: 9 }],
    decision: "FLAGGED",
    reviewerName: "Ada Admin",
  });
  const followMedium = scored({
    id: "follow-medium",
    levelEvents: [{ type: "CAMERA_DISCONNECTED", count: 5 }],
    decision: "NEEDS_FOLLOW_UP",
    reviewerName: "Ada Admin",
  });
  assert(openCritical.riskLevel === "CRITICAL", "open fixture is critical");
  assert(flaggedHigh.riskLevel === "HIGH", "flagged fixture is high");
  assert(followMedium.riskLevel === "MEDIUM", "follow-up fixture is medium");

  const active = queryProctoringReview(
    [clearedCritical, flaggedHigh, followMedium, openCritical],
    {
      risk: "needs_review",
      review: "active",
      category: "all",
      page: 1,
      pageSize: 20,
      windowDays: 30,
      truncated: false,
      eventsTruncated: false,
    },
  );
  assert(
    active.queue.map((row) => row.id).join(",") === "open-critical,follow-medium",
    "active queue keeps unreviewed critical and follow-up, not cleared or flagged",
  );
  assert(
    active.queue[0]?.reviewDecisionLabel === "Not reviewed yet",
    "unreviewed row is not labeled cleared",
  );
  const clearedOnly = queryProctoringReview(
    [clearedCritical, openCritical],
    {
      risk: "all",
      review: "cleared",
      category: "all",
      page: 1,
      pageSize: 20,
      windowDays: 30,
      truncated: false,
      eventsTruncated: false,
    },
  );
  assert(clearedOnly.total === 1 && clearedOnly.queue[0]?.id === "cleared-critical", "cleared remains searchable");
  const flaggedOnly = queryProctoringReview([flaggedHigh, openCritical], {
    risk: "all",
    review: "flagged",
    category: "all",
    page: 1,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(flaggedOnly.total === 1 && flaggedOnly.queue[0]?.id === "flagged-high", "flagged filter works");
  assert(active.overview.unreviewedHighCritical === 1, "unreviewed high or critical count");
  assert(active.overview.cleared === 1, "cleared count");
  assert(active.overview.flagged === 1, "flagged count");
  assert(active.overview.needsFollowUp === 1, "follow-up count");
  assert(active.overview.needsReview === 3, "risk needs-review count stays high plus critical");

  const grading = read("src/lib/actions/grading.ts");
  const submit = grading.slice(
    grading.indexOf("export async function submitProctoringReviewAction"),
    grading.indexOf("export async function getStudentResultDetailAction"),
  );
  assert(submit.includes("requireAdmin()"), "review write requires admin");
  assert(
    submit.indexOf("requireAdmin()") < submit.indexOf("saveProctoringCaseReview"),
    "admin check happens before the write",
  );
  assert(submit.includes("reviewerId: session.user.id"), "reviewer id comes from the session");
  assert(submit.includes("reviewedAt: new Date()"), "review time is generated on the server");
  assert(!submit.includes("data.reviewerId"), "payload reviewer id is not saved");
  assert(!submit.includes("data.reviewedAt"), "payload timestamp is not saved");
  assert(!submit.includes("SecurityEvent"), "review write does not touch security events");
  assert(!submit.includes("calculateRiskScore"), "review write does not rescore risk");
  assert(submit.includes( "Unable to save proctoring review."), "save errors stay generic");
  const studentFn = grading.slice(
    grading.indexOf("export async function getStudentResultDetailAction"),
  );
  assert(!studentFn.includes("proctoringReview"), "student result has no review payload");
  assert(!studentFn.includes("reviewerName"), "student result has no reviewer");
  assert(!studentFn.includes("riskScore"), "student result has no risk score");
  assert(
    read("src/lib/auth-guards.ts").includes('return requireRole(["admin"])'),
    "admin guard is admin-only",
  );
  const loader = read("src/lib/admin/proctoring-analytics.ts");
  assert(loader.includes("loadProctoringCaseReviews(attemptIds)"), "reviews load in one batch");
  assert(!loader.includes("ProctoringReview.findOne"), "queue does not load reviews one attempt at a time");
  const model = read("src/models/ProctoringReview.ts");
  assert(model.includes("unique: true"), "one current review per attempt");
  assert(!model.includes("riskScore"), "review model does not store risk");
  assert(read("src/components/admin/admin-proctoring-case-review.tsx").includes("Not reviewed yet") || read("src/lib/proctoring/case-review.ts").includes("Not reviewed yet"), "empty review copy exists");
  assert(
    !read("src/components/admin/admin-proctoring-case-review.tsx").toLowerCase().includes("cheater"),
    "review form does not accuse",
  );
  assert(read("src/app/layout.tsx").includes("Plus_Jakarta_Sans"), "font untouched");

  console.log("\nPhase 19 proctoring review checks passed.");
}

main();
