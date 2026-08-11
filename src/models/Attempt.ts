import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ATTEMPT_STATUSES } from "@/types/exam";

const AttemptSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ATTEMPT_STATUSES,
      default: "in_progress",
      required: true,
    },
    startedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
    durationMin: {
      type: Number,
      required: true,
      min: 1,
    },
    /** Snapshot of question order at exam start */
    questionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    assessmentTitle: {
      type: String,
      required: true,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 0,
    },
    resultId: {
      type: Schema.Types.ObjectId,
      ref: "Result",
      default: null,
    },
  },
  { timestamps: true },
);

AttemptSchema.index({ studentId: 1, assessmentId: 1, status: 1 });
AttemptSchema.index(
  { studentId: 1, assessmentId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "in_progress" },
  },
);
AttemptSchema.index({ expiresAt: 1, status: 1 });

export type AttemptDocument = InferSchemaType<typeof AttemptSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Attempt: Model<AttemptDocument> =
  mongoose.models.Attempt ||
  mongoose.model<AttemptDocument>("Attempt", AttemptSchema);
