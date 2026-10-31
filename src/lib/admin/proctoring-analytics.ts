import mongoose from "mongoose";
import { ActionError } from "@/lib/auth-guards";
import {
  PROCTORING_REVIEW_ATTEMPT_CAP,
  PROCTORING_REVIEW_EVENT_BATCH,
  PROCTORING_REVIEW_EVENT_BATCH_LIMIT,
  proctoringWindowStart,
  queryProctoringReview,
  scoreReviewAttempt,
  type ProctoringReviewQueueResult,
  type ReviewDecisionFilter,
  type ReviewRiskFilter,
} from "@/lib/proctoring/global-analytics";
import type { ReviewCategory } from "@/lib/proctoring/review";
import { Assessment } from "@/models/Assessment";
import { Attempt } from "@/models/Attempt";
import { SecurityEvent } from "@/models/SecurityEvent";
import { User } from "@/models/User";
import { loadProctoringCaseReviews } from "@/lib/admin/proctoring-case";

/**
 * One admin request:
 * 1. Optional student + assessment text match (2 queries)
 * 2. One Attempt find, newest first, cap 400
 * 3. One User find for names on that set
 * 4. SecurityEvent finds in batches of 80, 4_000 events per batch.
 *    Metadata is allowlisted to scoring fields after the read. Mixed
 *    sub-field projection can drop direction and duration.
 * 5. One ProctoringReview find for those attempt ids. Notes stay off the queue.
 * Risk filter, sort, and pagination happen in memory after scoring.
 * Overview counts use the full scored set, not the queue page.
 * Default window is the last 30 days. This is not an all-time scan.
 */

type ReviewQueueFilters = {
  windowDays: 7 | 30 | 90;
  page: number;
  pageSize: number;
  risk: ReviewRiskFilter;
  review: ReviewDecisionFilter;
  category: "all" | ReviewCategory;
  assessmentId: string;
  studentId: string;
  status: "all" | "in_progress" | "submitted" | "expired";
  search: string;
};

type LeanEvent = {
  _id: mongoose.Types.ObjectId;
  attemptId: mongoose.Types.ObjectId;
  eventType: string;
  severity: string;
  timestamp: Date;
  metadata?: Record<string, unknown> | null;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function attemptTextSearchClause(search: string) {
  const trimmed = search.trim().slice(0, 120);
  if (!trimmed) return null;
  const regex = new RegExp(escapeRegex(trimmed), "i");
  const [users, assessments] = await Promise.all([
    User.find({ $or: [{ name: regex }, { email: regex }] })
      .select("_id")
      .limit(300)
      .lean(),
    Assessment.find({ $or: [{ title: regex }, { code: regex }] })
      .select("_id")
      .limit(100)
      .lean(),
  ]);
  return {
    $or: [
      { studentId: { $in: users.map((user) => user._id) } },
      { assessmentId: { $in: assessments.map((assessment) => assessment._id) } },
      { assessmentTitle: regex },
    ],
  };
}

function scoringMetadata(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata || typeof metadata !== "object") return {};
  const safe: Record<string, unknown> = {};
  for (const key of [
    "direction",
    "durationMs",
    "confidence",
    "avgConfidence",
    "detectionConfidence",
  ]) {
    const value = metadata[key];
    if (typeof value === "string" || typeof value === "number") safe[key] = value;
  }
  return safe;
}

function groupEvents(events: LeanEvent[]) {
  const grouped = new Map<string, LeanEvent[]>();
  for (const event of events) {
    const id = event.attemptId.toString();
    const bucket = grouped.get(id);
    if (bucket) bucket.push(event);
    else grouped.set(id, [event]);
  }
  return grouped;
}

async function loadEventsForAttempts(attemptIds: string[]) {
  const eventsByAttempt = new Map<string, LeanEvent[]>();
  const excluded = new Set<string>();
  let eventsTruncated = false;

  for (
    let offset = 0;
    offset < attemptIds.length;
    offset += PROCTORING_REVIEW_EVENT_BATCH
  ) {
    const batchIds = attemptIds.slice(
      offset,
      offset + PROCTORING_REVIEW_EVENT_BATCH,
    );
    const events = (await SecurityEvent.find({ attemptId: { $in: batchIds } })
      .select("attemptId eventType severity timestamp metadata")
      .sort({ attemptId: 1, timestamp: 1 })
      .limit(PROCTORING_REVIEW_EVENT_BATCH_LIMIT + 1)
      .lean()) as unknown as LeanEvent[];

    if (events.length > PROCTORING_REVIEW_EVENT_BATCH_LIMIT) {
      eventsTruncated = true;
      const kept = events.slice(0, PROCTORING_REVIEW_EVENT_BATCH_LIMIT);
      const grouped = groupEvents(kept);
      const lastId = kept[kept.length - 1]?.attemptId.toString();
      if (lastId) grouped.delete(lastId);
      for (const id of batchIds) {
        if (!grouped.has(id)) excluded.add(id);
      }
      for (const [id, list] of grouped) eventsByAttempt.set(id, list);
    } else {
      for (const [id, list] of groupEvents(events)) eventsByAttempt.set(id, list);
    }
  }

  return { eventsByAttempt, excluded, eventsTruncated };
}

export async function loadProctoringReviewQueue(
  filters: ReviewQueueFilters,
): Promise<ProctoringReviewQueueResult> {
  const meta = {
    windowDays: filters.windowDays,
    truncated: false,
    eventsTruncated: false,
    risk: filters.risk,
    review: filters.review,
    category: filters.category,
    page: filters.page,
    pageSize: filters.pageSize,
  };

  if (filters.status === "in_progress") {
    return queryProctoringReview([], {
      ...meta,
      emptyReason: "in_progress",
    });
  }

  const since = proctoringWindowStart(filters.windowDays, Date.now());
  const statuses =
    filters.status === "all" ? ["submitted", "expired"] : [filters.status];
  const query: Record<string, unknown> = {
    status: statuses.length === 1 ? statuses[0] : { $in: statuses },
    $or: [
      { submittedAt: { $gte: since } },
      { submittedAt: null, startedAt: { $gte: since } },
    ],
  };

  if (filters.assessmentId !== "all") {
    if (!mongoose.Types.ObjectId.isValid(filters.assessmentId)) {
      throw new ActionError("Invalid assessment filter.");
    }
    query.assessmentId = filters.assessmentId;
  }
  if (filters.studentId !== "all") {
    if (!mongoose.Types.ObjectId.isValid(filters.studentId)) {
      throw new ActionError("Invalid student filter.");
    }
    query.studentId = filters.studentId;
  }

  const text = await attemptTextSearchClause(filters.search);
  if (text) query.$and = [text];

  const attempts = await Attempt.find(query)
    .select("studentId assessmentId assessmentTitle status startedAt submittedAt")
    .sort({ submittedAt: -1, startedAt: -1 })
    .limit(PROCTORING_REVIEW_ATTEMPT_CAP + 1)
    .lean();

  const truncated = attempts.length > PROCTORING_REVIEW_ATTEMPT_CAP;
  const selected = truncated
    ? attempts.slice(0, PROCTORING_REVIEW_ATTEMPT_CAP)
    : attempts;
  const attemptIds = selected.map((attempt) => attempt._id.toString());
  const studentIds = [...new Set(selected.map((attempt) => attempt.studentId.toString()))];

  const [events, caseReviews] = await Promise.all([
    loadEventsForAttempts(attemptIds),
    loadProctoringCaseReviews(attemptIds),
  ]);
  const reviewerIds = [...caseReviews.values()].map((review) => review.reviewerId);
  const peopleIds = [...new Set([...studentIds, ...reviewerIds])];
  const people = peopleIds.length
    ? await User.find({ _id: { $in: peopleIds } }).select("name email").lean()
    : [];

  const studentMap = new Map(people.map((person) => [person._id.toString(), person]));
  const scored = selected.flatMap((attempt) => {
    const id = attempt._id.toString();
    if (events.excluded.has(id)) return [];
    const student = studentMap.get(attempt.studentId.toString());
    const caseReview = caseReviews.get(id);
    const reviewer = caseReview
      ? studentMap.get(caseReview.reviewerId)
      : undefined;
    const attemptEvents = events.eventsByAttempt.get(id) ?? [];
    return [
      scoreReviewAttempt({
        id,
        studentName: student?.name ?? "Unknown",
        studentEmail: student?.email ?? "",
        assessmentId: attempt.assessmentId.toString(),
        assessmentTitle: attempt.assessmentTitle,
        status: attempt.status,
        completedAt: attempt.submittedAt
          ? new Date(attempt.submittedAt).toISOString()
          : attempt.startedAt
            ? new Date(attempt.startedAt).toISOString()
            : null,
        startedAt: new Date(attempt.startedAt).toISOString(),
        reviewDecision: caseReview?.decision ?? null,
        reviewerName: reviewer?.name ?? null,
        reviewedAt: caseReview?.reviewedAt ?? null,
        events: attemptEvents.map((event) => ({
          id: event._id.toString(),
          eventType: event.eventType,
          severity: event.severity,
          timestamp: new Date(event.timestamp).toISOString(),
          metadata: scoringMetadata(event.metadata),
        })),
      }),
    ];
  });

  return queryProctoringReview(scored, {
    ...meta,
    truncated,
    eventsTruncated: events.eventsTruncated,
  });
}
