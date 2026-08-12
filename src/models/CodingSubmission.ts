import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const VisibleCaseResultSchema = new Schema(
  {
    index: { type: Number, required: true },
    passed: { type: Boolean, required: true },
    status: { type: String, default: "" },
    timeMs: { type: Number, default: 0 },
    /** Student-safe messages only — never hidden expected outputs. */
    message: { type: String, default: "" },
  },
  { _id: false },
);

const CodingSubmissionSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
      index: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },
    language: {
      type: String,
      required: true,
    },
    sourceCode: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        "draft",
        "running",
        "accepted",
        "partial",
        "wrong_answer",
        "error",
        "timeout",
        "failed",
      ],
      default: "draft",
    },
    kind: {
      type: String,
      enum: ["run", "submit"],
      required: true,
    },
    passedTests: { type: Number, default: 0 },
    totalTests: { type: Number, default: 0 },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    executionTimeMs: { type: Number, default: 0 },
    visibleResults: { type: [VisibleCaseResultSchema], default: [] },
    finalized: { type: Boolean, default: false },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

CodingSubmissionSchema.index({ attemptId: 1, questionId: 1, kind: 1 });
CodingSubmissionSchema.index(
  { attemptId: 1, questionId: 1 },
  {
    unique: true,
    partialFilterExpression: { kind: "submit", finalized: true },
  },
);

export type CodingSubmissionDocument = InferSchemaType<
  typeof CodingSubmissionSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const CodingSubmission: Model<CodingSubmissionDocument> =
  mongoose.models.CodingSubmission ||
  mongoose.model<CodingSubmissionDocument>(
    "CodingSubmission",
    CodingSubmissionSchema,
  );
