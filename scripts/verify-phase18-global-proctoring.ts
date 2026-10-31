/**
 * Phase 18 — global proctoring analytics and review queue.
 * Run: npx tsx scripts/verify-phase18-global-proctoring.ts
 */
import fs from "node:fs";
import path from "node:path";
import { escapeCsvCell } from "../src/lib/admin/format";
import {
  EYE_GAZE_HORIZONTAL_CENTER_MIN,
  EYE_GAZE_PROLONGED_THRESHOLD_MS,
  EYE_GAZE_WARNING_THRESHOLD_MS,
} from "../src/lib/face/eye-gaze-constants";
import {
  HEAD_PROLONGED_THRESHOLD_MS,
  HEAD_WARNING_THRESHOLD_MS,
} from "../src/lib/face/head-pose-constants";
import {
  buildGlobalProctoringOverview,
  compareReviewPriority,
  DEFAULT_PROCTORING_REVIEW_WINDOW_DAYS,
  PROCTORING_REVIEW_ATTEMPT_CAP,
  queryProctoringReview,
  proctoringScopeLabel,
  proctoringWindowStart,
  scoreReviewAttempt,
  type ScoredReviewAttempt,
} from "../src/lib/proctoring/global-analytics";
import { ATTENTION_CORRELATION_WINDOW_MS, riskLevelFromScore } from "../src/lib/proctoring/risk";

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

function events(
  type: string,
  count: number,
  metadata: Record<string, unknown> = {},
) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${type}-${index}`,
    eventType: type,
    severity: "MEDIUM",
    timestamp: at(index * 1_000),
    metadata,
  }));
}

function attempt(input: {
  id: string;
  assessmentId: string;
  assessmentTitle: string;
  completedAt: string;
  events?: ReturnType<typeof events>;
  studentName?: string;
}): ScoredReviewAttempt {
  return scoreReviewAttempt({
    id: input.id,
    studentName: input.studentName ?? input.id,
    studentEmail: `${input.id}@example.com`,
    assessmentId: input.assessmentId,
    assessmentTitle: input.assessmentTitle,
    status: "submitted",
    completedAt: input.completedAt,
    startedAt: at(0),
    events: input.events ?? [],
  });
}

function main() {
  assert(HEAD_WARNING_THRESHOLD_MS === 5_000, "head warning timing unchanged");
  assert(HEAD_PROLONGED_THRESHOLD_MS === 10_000, "head prolonged timing unchanged");
  assert(EYE_GAZE_WARNING_THRESHOLD_MS === 5_000, "eye warning timing unchanged");
  assert(EYE_GAZE_PROLONGED_THRESHOLD_MS === 10_000, "eye prolonged timing unchanged");
  assert(EYE_GAZE_HORIZONTAL_CENTER_MIN === 0.35, "gaze center band unchanged");
  assert(ATTENTION_CORRELATION_WINDOW_MS === 20_000, "correlation window unchanged");
  assert(riskLevelFromScore(24) === "LOW", "LOW threshold unchanged");
  assert(riskLevelFromScore(25) === "MEDIUM", "MEDIUM threshold unchanged");
  assert(riskLevelFromScore(49) === "MEDIUM", "MEDIUM upper bound unchanged");
  assert(riskLevelFromScore(50) === "HIGH", "HIGH threshold unchanged");
  assert(riskLevelFromScore(74) === "HIGH", "HIGH upper bound unchanged");
  assert(riskLevelFromScore(75) === "CRITICAL", "CRITICAL threshold unchanged");
  assert(riskLevelFromScore(100) === "CRITICAL", "score cap stays in CRITICAL");

  const riskSource = read("src/lib/proctoring/risk.ts");
  assert(riskSource.includes("EYE_GAZE_AWAY: 2"), "eye away weight unchanged");
  assert(
    riskSource.includes("EYE_GAZE_AWAY_PROLONGED: 4"),
    "prolonged eye weight unchanged",
  );
  assert(
    !read("src/lib/proctoring/global-analytics.ts").includes("function calculateRiskScore"),
    "global analytics does not define a second score",
  );
  assert(
    read("src/lib/proctoring/global-analytics.ts").includes("analyzeProctoringAttempt"),
    "global scoring uses the canonical analyzer",
  );
  assert(
    read("src/lib/proctoring/global-analytics.ts").includes("buildProctoringReviewView"),
    "global incidents use the canonical review view",
  );

  const eye = attempt({
    id: "eye",
    assessmentId: "a",
    assessmentTitle: "Eye",
    completedAt: at(0),
    events: events("EYE_GAZE_AWAY", 1, { direction: "LEFT", durationMs: 8_000, confidence: 0.99 }),
  });
  assert(eye.riskScore === 5, "high-confidence gaze stays at conservative points");
  assert(eye.riskLevel === "LOW", "single gaze event stays LOW");

  const technical = attempt({
    id: "upload",
    assessmentId: "a",
    assessmentTitle: "Upload",
    completedAt: at(0),
    events: events("RECORDING_UPLOAD_FAILED", 4),
  });
  assert(technical.riskScore === 0, "upload failures add no behavioral risk");
  assert(technical.hasProctoringData, "upload failures still count as proctoring data");
  assert(technical.derivedIncidentCount === 0, "technical events are not derived incidents");

  const technicalOverview = buildGlobalProctoringOverview([technical], {
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(technicalOverview.noProctoringData === 0, "events are not missing data");
  assert(technicalOverview.noRecordedIncidents === 1, "technical-only is no recorded incidents");
  assert(technicalOverview.low === 1, "technical-only is not high risk");

  const none = attempt({
    id: "none",
    assessmentId: "a",
    assessmentTitle: "Empty",
    completedAt: at(0),
  });
  assert(!none.hasProctoringData, "no events is not proctoring data");
  assert(none.riskScore === 0, "no events score zero without being labeled safe by a second rule");
  const noneOverview = buildGlobalProctoringOverview([none], {
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(noneOverview.noProctoringData === 1, "no events tracked separately");
  assert(noneOverview.noRecordedIncidents === 0, "missing data is not no-incidents");

  let unknownThrew = false;
  try {
    const unknown = attempt({
      id: "legacy",
      assessmentId: "a",
      assessmentTitle: "Legacy",
      completedAt: at(0),
      events: events("OLD_CUSTOM_EVENT", 1, {}),
    });
    assert(Number.isFinite(unknown.riskScore), "legacy event produces a finite canonical score");
    assert(unknown.riskScore <= 100, "legacy event stays inside the cap");
  } catch {
    unknownThrew = true;
  }
  assert(!unknownThrew, "legacy event does not crash analytics");

  const tied = attempt({
    id: "tie",
    assessmentId: "a",
    assessmentTitle: "Tie",
    completedAt: at(0),
    events: [...events("NO_FACE_DETECTED", 1), ...events("FULLSCREEN_EXIT", 1)],
  });
  assert(tied.topCategory === "Face", "tied contribution keeps category order");

  const headEye = attempt({
    id: "fusion",
    assessmentId: "a",
    assessmentTitle: "Fusion",
    completedAt: at(0),
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
  });
  assert(headEye.rawEventCount === 4, "head+eye raw count stays 4");
  assert(headEye.derivedIncidentCount === 1, "head+eye remains one derived incident");
  assert(headEye.categoryPoints.eye === 0, "corroborated gaze points are not added again");
  assert(headEye.categoryPoints.head > 0, "corroboration stays on attention");
  const fusion = queryProctoringReview([headEye], {
    risk: "all",
    category: "all",
    page: 1,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(fusion.overview.derivedIncidents === 1, "global derived count does not multiply head+eye");
  assert(fusion.overview.rawEvents === 4, "global raw count stays separate");
  assert(!("categoryPoints" in fusion.queue[0]), "queue rows omit category maps");
  assert(!("events" in fusion.queue[0]), "queue rows omit events");

  const lows = Array.from({ length: 22 }, (_, index) =>
    attempt({
      id: `low-${String(index).padStart(2, "0")}`,
      assessmentId: index < 10 ? "assess-a" : "assess-b",
      assessmentTitle: index < 10 ? "Alpha" : "Beta",
      completedAt: new Date(Date.UTC(2026, 9, 31) - index * 86_400_000).toISOString(),
      studentName: index % 2 === 0 ? "Sam Student" : "Other Student",
    }),
  );
  const critical = attempt({
    id: "critical-old",
    assessmentId: "assess-a",
    assessmentTitle: "Alpha",
    completedAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
    events: events("MULTIPLE_FACES_DETECTED", 5),
    studentName: "Sam Student",
  });
  const high = attempt({
    id: "high-old",
    assessmentId: "assess-b",
    assessmentTitle: "Beta",
    completedAt: new Date(Date.UTC(2026, 0, 2)).toISOString(),
    events: events("TAB_SWITCH", 9),
  });
  const medium = attempt({
    id: "medium-old",
    assessmentId: "assess-b",
    assessmentTitle: "Beta",
    completedAt: new Date(Date.UTC(2026, 0, 3)).toISOString(),
    events: events("CAMERA_DISCONNECTED", 5),
  });
  assert(critical.riskLevel === "CRITICAL", "fixture critical band");
  assert(high.riskLevel === "HIGH", "fixture high band");
  assert(medium.riskLevel === "MEDIUM", "fixture medium band");
  assert(critical.riskScore > high.riskScore, "critical score ranks above high");

  const rows = [...lows, critical, high, medium];
  const newest20 = [...rows]
    .sort(
      (a, b) =>
        new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime(),
    )
    .slice(0, 20);
  assert(
    newest20.every((row) => row.riskLevel === "LOW"),
    "newest page of 20 would hide the older high-risk attempts",
  );
  assert(
    !newest20.some((row) => row.id === critical.id),
    "critical fixture is outside a newest-first page",
  );

  const global = queryProctoringReview(rows, {
    risk: "all",
    category: "all",
    page: 1,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(global.overview.totalAnalyzed === 25, "analytics count the full fixture, not one page");
  assert(global.overview.low === 22, "low distribution");
  assert(global.overview.medium === 1, "medium distribution");
  assert(global.overview.high === 1, "high distribution");
  assert(global.overview.critical === 1, "critical distribution");
  assert(global.overview.needsReview === 2, "needs review is high plus critical only");
  assert(global.overview.averageRiskDenominator === 25, "average denominator is analyzed attempts");
  assert(global.overview.averageRisk === 7, "average risk uses the full window");
  assert(global.overview.noProctoringData === 22, "event-free attempts counted separately");
  assert(global.queue[0]?.id === critical.id, "global page 1 starts with critical");
  assert(global.queue[1]?.id === high.id, "high follows critical");
  assert(global.queue[2]?.id === medium.id, "medium follows higher risk");
  assert(global.total === 25, "unfiltered queue total is global");
  assert(global.pageCount === 2, "fixture spans two review pages");
  assert(global.queue.length === 20, "page size is applied after the global sort");

  const page2 = queryProctoringReview(rows, {
    risk: "all",
    category: "all",
    page: 2,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(page2.queue.length === 5, "second page is the remainder after global sort");
  assert(
    page2.queue.every((row) => row.id !== critical.id),
    "critical is not repeated on page 2",
  );
  const clamped = queryProctoringReview(rows, {
    risk: "all",
    category: "all",
    page: 99,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(clamped.page === 2, "page past the end clamps after filtering");

  const review = queryProctoringReview(rows, {
    risk: "needs_review",
    category: "all",
    page: 1,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(review.total === 2, "risk filter runs before pagination");
  assert(review.queue.map((row) => row.id).join(",") === "critical-old,high-old", "review queue order");
  assert(review.overview.needsReview === 2, "window totals stay full when the queue is filtered");
  assert(
    review.queue.every((row) => row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL"),
    "needs review excludes medium and low",
  );

  const browser = queryProctoringReview(rows, {
    risk: "all",
    category: "browser",
    page: 1,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(browser.total === 1 && browser.queue[0]?.id === high.id, "category filter is global");

  const face = global.overview.categories.find((item) => item.id === "face");
  const browserTotal = global.overview.categories.find((item) => item.id === "browser");
  assert(face?.rawEvents === 5 && face.points === 90, "face category uses canonical points");
  assert(browserTotal?.rawEvents === 9 && browserTotal.points === 54, "browser category uses canonical points");
  assert(global.overview.derivedIncidents === 19, "derived incidents are not raw-event copies of folded groups");

  const alpha = global.overview.assessments.find((item) => item.assessmentId === "assess-a");
  const beta = global.overview.assessments.find((item) => item.assessmentId === "assess-b");
  assert(alpha?.attempts === 11, "assessment attempt count");
  assert(alpha?.averageRisk === 8.2, "assessment average is across its attempts");
  assert(alpha?.critical === 1 && alpha.high === 0, "assessment critical count");
  assert(alpha?.needsReview === 1 && alpha.reviewRateLabel === "1/11", "assessment review rate");
  assert(alpha?.topIncidentCategory === "Face", "assessment top category");
  assert(beta?.attempts === 14 && beta.averageRisk === 6, "second assessment average");
  assert(beta?.topIncidentCategory === "Browser", "second assessment top category");
  assert(global.overview.assessments[0]?.assessmentId === "assess-a", "assessments ordered by review need");

  const sameStudent = queryProctoringReview(
    [
      attempt({
        id: "attempt-1",
        assessmentId: "assess-a",
        assessmentTitle: "Alpha",
        completedAt: at(1),
        studentName: "Sam Student",
      }),
      attempt({
        id: "attempt-2",
        assessmentId: "assess-a",
        assessmentTitle: "Alpha",
        completedAt: at(2),
        studentName: "Sam Student",
      }),
    ],
    {
      risk: "all",
      category: "all",
      page: 1,
      pageSize: 20,
      windowDays: 30,
      truncated: false,
      eventsTruncated: false,
    },
  );
  assert(sameStudent.total === 2, "one attempt stays one review row");

  assert(
    compareReviewPriority(critical, high) < 0,
    "older critical outranks a more recent high score",
  );
  assert(DEFAULT_PROCTORING_REVIEW_WINDOW_DAYS === 30, "default window is 30 days");
  assert(PROCTORING_REVIEW_ATTEMPT_CAP === 400, "attempt cap is explicit");
  const origin = Date.UTC(2026, 9, 31);
  assert(
    proctoringWindowStart(30, origin).getTime() === origin - 30 * 24 * 60 * 60 * 1000,
    "window boundary is a fixed server offset",
  );
  assert(proctoringScopeLabel(30).includes("Last 30 days"), "window is visible");
  assert(!proctoringScopeLabel(30).toLowerCase().includes("all time"), "capped window is not called all time");
  assert(
    buildGlobalProctoringOverview([], {
      windowDays: 30,
      truncated: true,
      eventsTruncated: false,
    }).truncationNote.includes("400"),
    "truncation is disclosed",
  );

  const empty = queryProctoringReview([], {
    risk: "needs_review",
    category: "all",
    page: 1,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(empty.emptyReason === "no_attempts", "empty window reason");
  const filteredOut = queryProctoringReview([none], {
    risk: "needs_review",
    category: "all",
    page: 1,
    pageSize: 20,
    windowDays: 30,
    truncated: false,
    eventsTruncated: false,
  });
  assert(filteredOut.emptyReason === "no_matches", "filter miss reason");
  assert(filteredOut.overview.totalAnalyzed === 1, "filter miss keeps the window total");

  const grading = read("src/lib/actions/grading.ts");
  const action = grading.slice(
    grading.indexOf("export async function listProctoringReviewQueueAction"),
    grading.indexOf("export async function getStudentResultDetailAction"),
  );
  assert(action.includes("requireAdmin()"), "review queue requires admin");
  assert(
    action.indexOf("requireAdmin()") < action.indexOf("loadProctoringReviewQueue"),
    "admin check happens before the query",
  );
  assert(
    action.includes("Unable to load proctoring analytics."),
    "analytics errors stay generic",
  );
  const studentFn = grading.slice(grading.indexOf("export async function getStudentResultDetailAction"));
  assert(!studentFn.includes("riskScore"), "student result has no risk score");
  assert(!studentFn.includes("listProctoringReviewQueueAction"), "student result has no review queue");
  assert(!studentFn.includes("proctoringAnalysis"), "student result has no proctoring analysis");
  assert(
    grading.includes("attempt.studentId.toString() !== session.user.id"),
    "student result stays owner-checked",
  );

  const loader = read("src/lib/admin/proctoring-analytics.ts");
  assert(loader.includes("scoreReviewAttempt"), "loader uses the shared scorer");
  assert(loader.includes("email"), "search can match email");
  assert(loader.includes("assessmentTitle"), "search can match assessment title");
  assert(loader.includes("{ code: regex }"), "search can match assessment code");
  assert(!loader.includes(".skip("), "review queue does not paginate before scoring");
  assert(!loader.includes("findOne("), "review queue does not query events per attempt");
  assert(loader.includes("PROCTORING_REVIEW_EVENT_BATCH"), "events load in batches");
  assert(!read("src/models/Attempt.ts").includes("riskScore"), "risk is not persisted on Attempt");
  assert(
    read("src/models/Attempt.ts").includes("{ status: 1, submittedAt: -1 }"),
    "attempt window index added",
  );

  const results = read("src/components/admin/admin-results-client.tsx");
  const queueUi = read("src/components/admin/admin-proctoring-review.tsx");
  assert(!results.includes("on this page"), "page-scoped KPI labels removed");
  assert(!results.includes("Highest risk on this page"), "page-only risk sort removed");
  assert(results.includes("AdminProctoringReview"), "results page hosts the queue");
  assert(queueUi.includes("/admin/results/${row.id}"), "queue opens the existing attempt review");
  assert(queueUi.includes("Total analyzed attempts"), "global analyzed label");
  assert(queueUi.includes("Needs review"), "needs review label");
  assert(queueUi.includes("No proctoring data"), "missing data label");
  assert(
    queueUi.includes("does not automatically determine misconduct"),
    "review disclaimer",
  );
  assert(!queueUi.includes("Cheater"), "no cheating label");
  assert(!queueUi.includes("recharts"), "no new chart library");
  assert(!fs.existsSync(path.join(process.cwd(), "src/app/admin/proctoring-analytics")), "no duplicate analytics route");
  assert(read("src/app/admin/results/page.tsx").includes("AdminResultsClient"), "canonical surface remains results");
  assert(
    read("src/components/admin/admin-proctoring-analysis-report.tsx").includes("buildProctoringReviewView"),
    "attempt detail still uses the canonical review view",
  );
  assert(escapeCsvCell("=1+1").startsWith("'"), "csv formula protection remains");
  assert(read("src/app/layout.tsx").includes("Plus_Jakarta_Sans"), "font untouched");
  assert(read("src/lib/face/eye-gaze-estimator.ts").includes("EYE_GAZE_HORIZONTAL_CENTER_MIN") || read("src/lib/face/eye-gaze-constants.ts").includes("0.35"), "estimator constants file still owns the center band");

  console.log("\nPhase 18 global proctoring analytics checks passed.");
}

main();
