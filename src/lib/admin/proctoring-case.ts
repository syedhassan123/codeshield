import mongoose from "mongoose";
import { ActionError } from "@/lib/auth-guards";
import {
  applyProctoringReview,
  presentProctoringCaseReview,
  type ProctoringCaseDecision,
  type ProctoringCaseReviewView,
  type StoredProctoringReview,
} from "@/lib/proctoring/case-review";
import { Attempt } from "@/models/Attempt";
import { ProctoringReview } from "@/models/ProctoringReview";
import { User } from "@/models/User";

type LeanReview = {
  attemptId: mongoose.Types.ObjectId;
  version: number;
  decision: ProctoringCaseDecision;
  note?: string | null;
  reviewerId: mongoose.Types.ObjectId;
  reviewedAt: Date;
  history?: Array<{
    version: number;
    decision: ProctoringCaseDecision;
    note?: string | null;
    reviewerId: mongoose.Types.ObjectId;
    reviewedAt: Date;
  }>;
};

function toStored(doc: LeanReview): StoredProctoringReview {
  return {
    attemptId: doc.attemptId.toString(),
    version: doc.version,
    decision: doc.decision,
    note: doc.note ?? "",
    reviewerId: doc.reviewerId.toString(),
    reviewedAt: new Date(doc.reviewedAt).toISOString(),
    history: (doc.history ?? []).map((entry) => ({
      version: entry.version,
      decision: entry.decision,
      note: entry.note ?? "",
      reviewerId: entry.reviewerId.toString(),
      reviewedAt: new Date(entry.reviewedAt).toISOString(),
    })),
  };
}

async function namesFor(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, string>();
  const users = await User.find({ _id: { $in: unique } }).select("name").lean();
  return new Map(users.map((user) => [user._id.toString(), user.name]));
}

export async function loadProctoringCaseReviews(attemptIds: string[]) {
  if (!attemptIds.length) return new Map<string, StoredProctoringReview>();
  const docs = (await ProctoringReview.find({ attemptId: { $in: attemptIds } })
    .select("attemptId version decision reviewerId reviewedAt")
    .lean()) as unknown as LeanReview[];
  return new Map(docs.map((doc) => [doc.attemptId.toString(), toStored(doc)]));
}

export async function loadProctoringCaseReviewView(
  attemptId: string,
): Promise<ProctoringCaseReviewView> {
  if (!mongoose.Types.ObjectId.isValid(attemptId)) {
    return presentProctoringCaseReview(null, new Map());
  }
  const doc = (await ProctoringReview.findOne({ attemptId })
    .lean()) as unknown as LeanReview | null;
  const record = doc ? toStored(doc) : null;
  const ids = record
    ? [record.reviewerId, ...record.history.map((entry) => entry.reviewerId)]
    : [];
  return presentProctoringCaseReview(record, await namesFor(ids));
}

export async function saveProctoringCaseReview(input: {
  attemptId: string;
  decision: ProctoringCaseDecision;
  note: string;
  expectedVersion: number;
  reviewerId: string;
  reviewedAt: Date;
}) {
  if (
    !mongoose.Types.ObjectId.isValid(input.attemptId) ||
    !mongoose.Types.ObjectId.isValid(input.reviewerId)
  ) {
    throw new ActionError("Attempt not found.");
  }

  const attempt = await Attempt.findById(input.attemptId).select("status");
  if (!attempt) throw new ActionError("Attempt not found.");
  if (attempt.status !== "submitted" && attempt.status !== "expired") {
    throw new ActionError(
      "Proctoring review is available after the attempt is submitted or expired.",
    );
  }

  const existingDoc = (await ProctoringReview.findOne({
    attemptId: input.attemptId,
  }).lean()) as unknown as LeanReview | null;
  const applied = applyProctoringReview(existingDoc ? toStored(existingDoc) : null, {
    attemptId: input.attemptId,
    expectedVersion: input.expectedVersion,
    decision: input.decision,
    note: input.note,
    reviewerId: input.reviewerId,
    reviewedAt: input.reviewedAt.toISOString(),
  });
  if (!applied.ok) return { ok: false as const, conflict: true as const };

  let stored = applied.record;
  if (!applied.unchanged) {
    const payload = {
      attemptId: input.attemptId,
      version: applied.record.version,
      decision: applied.record.decision,
      note: applied.record.note,
      reviewerId: input.reviewerId,
      reviewedAt: input.reviewedAt,
      history: applied.record.history.map((entry) => ({
        version: entry.version,
        decision: entry.decision,
        note: entry.note,
        reviewerId: entry.reviewerId,
        reviewedAt: new Date(entry.reviewedAt),
      })),
    };
    if (!existingDoc) {
      try {
        await ProctoringReview.create(payload);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "code" in error &&
          (error as { code?: number }).code === 11000
        ) {
          return { ok: false as const, conflict: true as const };
        }
        throw error;
      }
    } else {
      const updated = await ProctoringReview.findOneAndUpdate(
        { attemptId: input.attemptId, version: input.expectedVersion },
        { $set: payload },
        { new: true },
      ).lean();
      if (!updated) return { ok: false as const, conflict: true as const };
      stored = toStored(updated as unknown as LeanReview);
    }
  }

  const view = presentProctoringCaseReview(
    stored,
    await namesFor([
      stored.reviewerId,
      ...stored.history.map((entry) => entry.reviewerId),
    ]),
  );
  return { ok: true as const, review: view };
}
