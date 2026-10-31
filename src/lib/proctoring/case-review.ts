export const PROCTORING_CASE_DECISIONS = [
  "CLEARED",
  "FLAGGED",
  "NEEDS_FOLLOW_UP",
] as const;

export type ProctoringCaseDecision = (typeof PROCTORING_CASE_DECISIONS)[number];

export const PROCTORING_CASE_NOTE_MAX = 5000;

export const REVIEW_CONFLICT_MESSAGE =
  "This review was updated by another administrator. Refresh and try again.";

export type ProctoringCaseRevision = {
  version: number;
  decision: ProctoringCaseDecision;
  note: string;
  reviewerId: string;
  reviewedAt: string;
};

export type StoredProctoringReview = {
  attemptId: string;
  version: number;
  decision: ProctoringCaseDecision;
  note: string;
  reviewerId: string;
  reviewedAt: string;
  history: ProctoringCaseRevision[];
};

export type ProctoringCaseHistoryItem = {
  version: number;
  decision: ProctoringCaseDecision;
  decisionLabel: string;
  note: string;
  reviewedAt: string;
  reviewerName: string;
};

export type ProctoringCaseReviewView = {
  status: "UNREVIEWED" | "REVIEWED";
  decision: ProctoringCaseDecision | null;
  decisionLabel: string;
  note: string;
  reviewedAt: string | null;
  reviewerName: string | null;
  version: number;
  history: ProctoringCaseHistoryItem[];
};

export type ReviewApplyResult =
  | { ok: true; unchanged: boolean; record: StoredProctoringReview }
  | { ok: false; conflict: true };

export function proctoringCaseDecisionLabel(
  decision: ProctoringCaseDecision | null,
) {
  if (decision === "CLEARED") return "Cleared";
  if (decision === "FLAGGED") return "Flagged for review";
  if (decision === "NEEDS_FOLLOW_UP") return "Needs follow-up";
  return "Not reviewed yet";
}

export function isProctoringCaseDecision(
  value: string,
): value is ProctoringCaseDecision {
  return (PROCTORING_CASE_DECISIONS as readonly string[]).includes(value);
}

export function unreviewedProctoringCase(): ProctoringCaseReviewView {
  return {
    status: "UNREVIEWED",
    decision: null,
    decisionLabel: proctoringCaseDecisionLabel(null),
    note: "",
    reviewedAt: null,
    reviewerName: null,
    version: 0,
    history: [],
  };
}

function sameContent(
  record: StoredProctoringReview,
  decision: ProctoringCaseDecision,
  note: string,
) {
  return record.decision === decision && record.note === note;
}

/**
 * Apply one admin decision.
 * reviewerId and reviewedAt are supplied by the server.
 * Identical content does not append history.
 * A different decision with a stale version conflicts.
 */
export function applyProctoringReview(
  current: StoredProctoringReview | null,
  input: {
    attemptId: string;
    expectedVersion: number;
    decision: ProctoringCaseDecision;
    note: string;
    reviewerId: string;
    reviewedAt: string;
  },
): ReviewApplyResult {
  const note = input.note.trim();
  if (!current) {
    if (input.expectedVersion !== 0) return { ok: false, conflict: true };
    return {
      ok: true,
      unchanged: false,
      record: {
        attemptId: input.attemptId,
        version: 1,
        decision: input.decision,
        note,
        reviewerId: input.reviewerId,
        reviewedAt: input.reviewedAt,
        history: [],
      },
    };
  }

  if (sameContent(current, input.decision, note)) {
    return { ok: true, unchanged: true, record: current };
  }

  if (current.version !== input.expectedVersion) {
    return { ok: false, conflict: true };
  }

  return {
    ok: true,
    unchanged: false,
    record: {
      attemptId: current.attemptId,
      version: current.version + 1,
      decision: input.decision,
      note,
      reviewerId: input.reviewerId,
      reviewedAt: input.reviewedAt,
      history: [
        ...current.history,
        {
          version: current.version,
          decision: current.decision,
          note: current.note,
          reviewerId: current.reviewerId,
          reviewedAt: current.reviewedAt,
        },
      ],
    },
  };
}

export function presentProctoringCaseReview(
  record: StoredProctoringReview | null,
  names: ReadonlyMap<string, string>,
): ProctoringCaseReviewView {
  if (!record) return unreviewedProctoringCase();
  return {
    status: "REVIEWED",
    decision: record.decision,
    decisionLabel: proctoringCaseDecisionLabel(record.decision),
    note: record.note,
    reviewedAt: record.reviewedAt,
    reviewerName: names.get(record.reviewerId) ?? "Unknown",
    version: record.version,
    history: record.history.map((entry) => ({
      version: entry.version,
      decision: entry.decision,
      decisionLabel: proctoringCaseDecisionLabel(entry.decision),
      note: entry.note,
      reviewedAt: entry.reviewedAt,
      reviewerName: names.get(entry.reviewerId) ?? "Unknown",
    })),
  };
}
