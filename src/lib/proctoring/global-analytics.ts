import { analyzeProctoringAttempt } from "@/lib/proctoring/analyze";
import {
  primaryReviewCategory,
  REVIEW_CATEGORIES,
  reviewCategoryLabel,
  buildProctoringReviewView,
  type ReviewCategory,
} from "@/lib/proctoring/review";
import {
  proctoringCaseDecisionLabel,
  type ProctoringCaseDecision,
} from "@/lib/proctoring/case-review";
import type { ProctoringAnalyzeInput, ProctoringRiskLevel } from "@/lib/proctoring/types";

/** Rolling window choices. Never presented as all-time. */
export const PROCTORING_REVIEW_WINDOW_DAYS = [7, 30, 90] as const;
export const DEFAULT_PROCTORING_REVIEW_WINDOW_DAYS = 30;

/** Newest attempts kept inside the window. Older ones are reported as truncated. */
export const PROCTORING_REVIEW_ATTEMPT_CAP = 400;

/** Event reads are batched so one attempt cannot be split across a global limit. */
export const PROCTORING_REVIEW_EVENT_BATCH = 80;
export const PROCTORING_REVIEW_EVENT_BATCH_LIMIT = 4_000;

const RISK_RANK: Record<ProctoringRiskLevel, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export type ReviewRiskFilter =
  | "all"
  | "needs_review"
  | ProctoringRiskLevel;

export type ReviewDecisionFilter =
  | "all"
  | "active"
  | "unreviewed"
  | "cleared"
  | "flagged"
  | "needs_follow_up";

export type ScoredReviewAttempt = {
  id: string;
  studentName: string;
  studentEmail: string;
  assessmentId: string;
  assessmentTitle: string;
  status: string;
  completedAt: string | null;
  riskScore: number;
  riskLevel: ProctoringRiskLevel;
  recommendation: string;
  rawEventCount: number;
  derivedIncidentCount: number;
  securityEventCount: number;
  hasProctoringData: boolean;
  topCategory: string | null;
  topCategoryId: ReviewCategory | null;
  categoryPoints: Record<ReviewCategory, number>;
  categoryRaw: Record<ReviewCategory, number>;
  reviewDecision: ProctoringCaseDecision | null;
  reviewerName: string | null;
  reviewedAt: string | null;
};

export type ReviewQueueRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  assessmentId: string;
  assessmentTitle: string;
  status: string;
  completedAt: string | null;
  riskScore: number;
  riskLevel: ProctoringRiskLevel;
  recommendation: string;
  rawEventCount: number;
  derivedIncidentCount: number;
  hasProctoringData: boolean;
  topCategory: string | null;
  reviewStatus: "UNREVIEWED" | "REVIEWED";
  reviewDecision: ProctoringCaseDecision | null;
  reviewDecisionLabel: string;
  reviewerName: string | null;
};

export type AssessmentRiskRow = {
  assessmentId: string;
  title: string;
  attempts: number;
  averageRisk: number;
  high: number;
  critical: number;
  needsReview: number;
  reviewRateLabel: string;
  topIncidentCategory: string | null;
};

export type GlobalCategoryTotal = {
  id: ReviewCategory;
  label: string;
  rawEvents: number;
  points: number;
};

export type GlobalProctoringOverview = {
  windowDays: number;
  scopeLabel: string;
  truncationNote: string;
  truncated: boolean;
  eventsTruncated: boolean;
  attemptCap: number;
  totalAnalyzed: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  needsReview: number;
  unreviewedHighCritical: number;
  cleared: number;
  flagged: number;
  needsFollowUp: number;
  /** Reviewed high or critical / high or critical attempts. */
  reviewCompletionLabel: string;
  /** Mean riskScore across totalAnalyzed. No-event attempts count as 0. */
  averageRisk: number;
  averageRiskDenominator: number;
  noProctoringData: number;
  noRecordedIncidents: number;
  rawEvents: number;
  derivedIncidents: number;
  categories: GlobalCategoryTotal[];
  assessments: AssessmentRiskRow[];
};

export type ProctoringReviewQueueResult = {
  overview: GlobalProctoringOverview;
  queue: ReviewQueueRow[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  emptyReason: "none" | "no_attempts" | "no_matches" | "in_progress";
};

export function proctoringWindowStart(windowDays: number, nowMs: number) {
  return new Date(nowMs - windowDays * 24 * 60 * 60 * 1000);
}

export function proctoringScopeLabel(windowDays: number) {
  return `Last ${windowDays} days · submitted and expired attempts`;
}

export function proctoringTruncationNote(input: {
  truncated: boolean;
  eventsTruncated: boolean;
  attemptCap: number;
}) {
  const parts: string[] = [];
  if (input.truncated) {
    parts.push(
      `Limited to the ${input.attemptCap} most recent attempts in this window.`,
    );
  }
  if (input.eventsTruncated) {
    parts.push(
      "Some attempts were left out because their proctoring events could not be fully loaded.",
    );
  }
  return parts.join(" ");
}

function emptyCategoryPoints(): Record<ReviewCategory, number> {
  return {
    face: 0,
    head: 0,
    eye: 0,
    browser: 0,
    camera: 0,
    technical: 0,
  };
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function completedMs(value: string | null) {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function scoreReviewAttempt(input: {
  id: string;
  studentName: string;
  studentEmail: string;
  assessmentId: string;
  assessmentTitle: string;
  status: string;
  completedAt: string | null;
  startedAt: string;
  events: ProctoringAnalyzeInput["events"];
  reviewDecision?: ProctoringCaseDecision | null;
  reviewerName?: string | null;
  reviewedAt?: string | null;
}): ScoredReviewAttempt {
  const review = buildProctoringReviewView(
    analyzeProctoringAttempt({
      events: input.events,
      attemptStartedAt: input.startedAt,
      recordingStartedAt: null,
    }),
  );
  const categoryPoints = emptyCategoryPoints();
  const categoryRaw = emptyCategoryPoints();
  for (const category of review.categories) {
    categoryPoints[category.id] = category.points;
    categoryRaw[category.id] = category.rawEvents;
  }
  return {
    id: input.id,
    studentName: input.studentName,
    studentEmail: input.studentEmail,
    assessmentId: input.assessmentId,
    assessmentTitle: input.assessmentTitle,
    status: input.status,
    completedAt: input.completedAt,
    riskScore: review.riskScore,
    riskLevel: review.riskLevel,
    recommendation: review.recommendation,
    rawEventCount: review.rawEventCount,
    derivedIncidentCount: review.derivedIncidentCount,
    securityEventCount: input.events.length,
    hasProctoringData: input.events.length > 0,
    topCategory: review.topCategory,
    topCategoryId: review.topCategoryId,
    categoryPoints,
    categoryRaw,
    reviewDecision: input.reviewDecision ?? null,
    reviewerName: input.reviewerName ?? null,
    reviewedAt: input.reviewedAt ?? null,
  };
}

function queueGroup(row: {
  riskLevel: ProctoringRiskLevel;
  reviewDecision?: ProctoringCaseDecision | null;
}) {
  if (!row.reviewDecision) return RISK_RANK[row.riskLevel];
  if (row.reviewDecision === "NEEDS_FOLLOW_UP") return 4;
  if (row.reviewDecision === "FLAGGED") return 5;
  return 6;
}

export function compareReviewPriority(
  a: Pick<
    ScoredReviewAttempt,
    "riskLevel" | "riskScore" | "completedAt" | "id" | "reviewDecision"
  >,
  b: Pick<
    ScoredReviewAttempt,
    "riskLevel" | "riskScore" | "completedAt" | "id" | "reviewDecision"
  >,
) {
  const group = queueGroup(a) - queueGroup(b);
  if (group !== 0) return group;
  const rank = RISK_RANK[a.riskLevel] - RISK_RANK[b.riskLevel];
  if (rank !== 0) return rank;
  if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
  const recency = completedMs(b.completedAt) - completedMs(a.completedAt);
  if (recency !== 0) return recency;
  return a.id.localeCompare(b.id);
}

function passesRisk(row: ScoredReviewAttempt, risk: ReviewRiskFilter) {
  if (risk === "all") return true;
  if (risk === "needs_review") {
    return row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL";
  }
  return row.riskLevel === risk;
}

function passesDecision(row: ScoredReviewAttempt, review: ReviewDecisionFilter) {
  const decision = row.reviewDecision ?? null;
  if (review === "all") return true;
  if (review === "unreviewed") return decision == null;
  if (review === "cleared") return decision === "CLEARED";
  if (review === "flagged") return decision === "FLAGGED";
  if (review === "needs_follow_up") return decision === "NEEDS_FOLLOW_UP";
  if (decision === "NEEDS_FOLLOW_UP") return true;
  return (
    decision == null &&
    (row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL")
  );
}

export function filterReviewAttempts(
  rows: ScoredReviewAttempt[],
  filters: {
    risk: ReviewRiskFilter;
    category: "all" | ReviewCategory;
    review?: ReviewDecisionFilter;
  },
) {
  const review = filters.review ?? "all";
  return rows.filter((row) => {
    if (review === "active") {
      const followUp = row.reviewDecision === "NEEDS_FOLLOW_UP";
      const unreviewedHigh =
        !row.reviewDecision &&
        (row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL");
      if (!followUp && !unreviewedHigh) return false;
      if (!followUp && !passesRisk(row, filters.risk)) return false;
      if (
        followUp &&
        filters.risk !== "needs_review" &&
        filters.risk !== "all" &&
        row.riskLevel !== filters.risk
      ) {
        return false;
      }
    } else if (!passesRisk(row, filters.risk) || !passesDecision(row, review)) {
      return false;
    }
    if (filters.category !== "all") {
      const points = row.categoryPoints[filters.category] ?? 0;
      const raw = row.categoryRaw[filters.category] ?? 0;
      if (points <= 0 && raw <= 0) return false;
    }
    return true;
  });
}

function toQueueRow(row: ScoredReviewAttempt): ReviewQueueRow {
  return {
    id: row.id,
    studentName: row.studentName,
    studentEmail: row.studentEmail,
    assessmentId: row.assessmentId,
    assessmentTitle: row.assessmentTitle,
    status: row.status,
    completedAt: row.completedAt,
    riskScore: row.riskScore,
    riskLevel: row.riskLevel,
    recommendation: row.recommendation,
    rawEventCount: row.rawEventCount,
    derivedIncidentCount: row.derivedIncidentCount,
    hasProctoringData: row.hasProctoringData,
    topCategory: row.topCategory,
    reviewStatus: row.reviewDecision ? "REVIEWED" : "UNREVIEWED",
    reviewDecision: row.reviewDecision,
    reviewDecisionLabel: proctoringCaseDecisionLabel(row.reviewDecision),
    reviewerName: row.reviewerName,
  };
}

export function buildGlobalProctoringOverview(
  rows: ScoredReviewAttempt[],
  meta: {
    windowDays: number;
    truncated: boolean;
    eventsTruncated: boolean;
  },
): GlobalProctoringOverview {
  let low = 0;
  let medium = 0;
  let high = 0;
  let critical = 0;
  let noProctoringData = 0;
  let noRecordedIncidents = 0;
  let rawEvents = 0;
  let derivedIncidents = 0;
  let scoreSum = 0;
  let unreviewedHighCritical = 0;
  let cleared = 0;
  let flagged = 0;
  let needsFollowUp = 0;
  let reviewedHighCritical = 0;
  const categoryPoints = emptyCategoryPoints();
  const categoryRaw = emptyCategoryPoints();
  const byAssessment = new Map<
    string,
    {
      title: string;
      attempts: number;
      scoreSum: number;
      high: number;
      critical: number;
      points: Record<ReviewCategory, number>;
    }
  >();

  for (const row of rows) {
    scoreSum += row.riskScore;
    rawEvents += row.rawEventCount;
    derivedIncidents += row.derivedIncidentCount;
    if (row.riskLevel === "LOW") low += 1;
    else if (row.riskLevel === "MEDIUM") medium += 1;
    else if (row.riskLevel === "HIGH") high += 1;
    else critical += 1;
    if (!row.hasProctoringData) noProctoringData += 1;
    else if (row.derivedIncidentCount === 0) noRecordedIncidents += 1;
    for (const id of REVIEW_CATEGORIES) {
      categoryPoints[id] += row.categoryPoints[id];
      categoryRaw[id] += row.categoryRaw[id];
    }
    const bucket = byAssessment.get(row.assessmentId) ?? {
      title: row.assessmentTitle,
      attempts: 0,
      scoreSum: 0,
      high: 0,
      critical: 0,
      points: emptyCategoryPoints(),
    };
    bucket.attempts += 1;
    bucket.scoreSum += row.riskScore;
    if (row.riskLevel === "HIGH") bucket.high += 1;
    if (row.riskLevel === "CRITICAL") bucket.critical += 1;
    if (!row.reviewDecision && (row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL")) {
      unreviewedHighCritical += 1;
    }
    if (
      row.reviewDecision &&
      (row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL")
    ) {
      reviewedHighCritical += 1;
    }
    if (row.reviewDecision === "CLEARED") cleared += 1;
    else if (row.reviewDecision === "FLAGGED") flagged += 1;
    else if (row.reviewDecision === "NEEDS_FOLLOW_UP") needsFollowUp += 1;
    for (const id of REVIEW_CATEGORIES) {
      bucket.points[id] += row.categoryPoints[id];
    }
    byAssessment.set(row.assessmentId, bucket);
  }

  const categories: GlobalCategoryTotal[] = REVIEW_CATEGORIES.flatMap((id) => {
    const points = categoryPoints[id];
    const raw = categoryRaw[id];
    if (points === 0 && raw === 0) return [];
    return [{ id, label: reviewCategoryLabel(id), rawEvents: raw, points }];
  }).sort((a, b) => b.points - a.points || REVIEW_CATEGORIES.indexOf(a.id) - REVIEW_CATEGORIES.indexOf(b.id));

  const assessments: AssessmentRiskRow[] = [...byAssessment.entries()]
    .map(([assessmentId, bucket]) => {
      const needsReview = bucket.high + bucket.critical;
      const topId = primaryReviewCategory(
        REVIEW_CATEGORIES.map((id) => ({ id, points: bucket.points[id] })),
      );
      return {
        assessmentId,
        title: bucket.title,
        attempts: bucket.attempts,
        averageRisk: round1(bucket.scoreSum / bucket.attempts),
        high: bucket.high,
        critical: bucket.critical,
        needsReview,
        reviewRateLabel: `${needsReview}/${bucket.attempts}`,
        topIncidentCategory: topId ? reviewCategoryLabel(topId) : null,
      };
    })
    .sort(
      (a, b) =>
        b.needsReview - a.needsReview ||
        b.averageRisk - a.averageRisk ||
        a.title.localeCompare(b.title),
    );

  const totalAnalyzed = rows.length;
  return {
    windowDays: meta.windowDays,
    scopeLabel: proctoringScopeLabel(meta.windowDays),
    truncationNote: proctoringTruncationNote({
      truncated: meta.truncated,
      eventsTruncated: meta.eventsTruncated,
      attemptCap: PROCTORING_REVIEW_ATTEMPT_CAP,
    }),
    truncated: meta.truncated,
    eventsTruncated: meta.eventsTruncated,
    attemptCap: PROCTORING_REVIEW_ATTEMPT_CAP,
    totalAnalyzed,
    low,
    medium,
    high,
    critical,
    needsReview: high + critical,
    unreviewedHighCritical,
    cleared,
    flagged,
    needsFollowUp,
    reviewCompletionLabel: `${reviewedHighCritical}/${high + critical}`,
    averageRisk: totalAnalyzed ? round1(scoreSum / totalAnalyzed) : 0,
    averageRiskDenominator: totalAnalyzed,
    noProctoringData,
    noRecordedIncidents,
    rawEvents,
    derivedIncidents,
    categories,
    assessments,
  };
}

export function queryProctoringReview(
  rows: ScoredReviewAttempt[],
  query: {
    risk: ReviewRiskFilter;
    review?: ReviewDecisionFilter;
    category: "all" | ReviewCategory;
    page: number;
    pageSize: number;
    windowDays: number;
    truncated: boolean;
    eventsTruncated: boolean;
    emptyReason?: ProctoringReviewQueueResult["emptyReason"];
  },
): ProctoringReviewQueueResult {
  const overview = buildGlobalProctoringOverview(rows, query);
  const filtered = filterReviewAttempts(rows, query).sort(compareReviewPriority);
  const pageCount = Math.max(1, Math.ceil(filtered.length / query.pageSize));
  const page = Math.min(Math.max(1, query.page), pageCount);
  const start = (page - 1) * query.pageSize;
  let emptyReason = query.emptyReason ?? "none";
  if (emptyReason === "none") {
    if (overview.totalAnalyzed === 0) emptyReason = "no_attempts";
    else if (filtered.length === 0) emptyReason = "no_matches";
  }
  return {
    overview,
    queue: filtered.slice(start, start + query.pageSize).map(toQueueRow),
    total: filtered.length,
    page,
    pageSize: query.pageSize,
    pageCount,
    emptyReason,
  };
}
