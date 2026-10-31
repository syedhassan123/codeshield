import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { PROCTORING_CASE_DECISIONS } from "@/lib/proctoring/case-review";

const RevisionSchema = new Schema(
  {
    version: { type: Number, required: true, min: 1 },
    decision: {
      type: String,
      enum: PROCTORING_CASE_DECISIONS,
      required: true,
    },
    note: { type: String, default: "", maxlength: 5000 },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewedAt: { type: Date, required: true },
  },
  { _id: false },
);

const ProctoringReviewSchema = new Schema(
  {
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
    },
    version: { type: Number, required: true, min: 1 },
    decision: {
      type: String,
      enum: PROCTORING_CASE_DECISIONS,
      required: true,
    },
    note: { type: String, default: "", maxlength: 5000 },
    reviewerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewedAt: { type: Date, required: true },
    history: { type: [RevisionSchema], default: [] },
  },
  { timestamps: true },
);

ProctoringReviewSchema.index({ attemptId: 1 }, { unique: true });
ProctoringReviewSchema.index({ reviewerId: 1, reviewedAt: -1 });
ProctoringReviewSchema.index({ decision: 1, reviewedAt: -1 });

export type ProctoringReviewDocument = InferSchemaType<
  typeof ProctoringReviewSchema
> & {
  _id: mongoose.Types.ObjectId;
};

function getProctoringReviewModel(): Model<ProctoringReviewDocument> {
  const cached = mongoose.models.ProctoringReview as
    | Model<ProctoringReviewDocument>
    | undefined;
  if (cached) return cached;
  return mongoose.model<ProctoringReviewDocument>(
    "ProctoringReview",
    ProctoringReviewSchema,
  );
}

export const ProctoringReview: Model<ProctoringReviewDocument> =
  getProctoringReviewModel();
