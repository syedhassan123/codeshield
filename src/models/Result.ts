import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ANSWER_EVAL_STATUSES } from "@/types/exam";

const ResultQuestionSchema = new Schema(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    type: { type: String, required: true },
    points: { type: Number, required: true },
    awardedPoints: { type: Number, required: true, default: 0 },
    evalStatus: {
      type: String,
      enum: ANSWER_EVAL_STATUSES,
      required: true,
    },
    selectedOptionKey: { type: String, default: "" },
    correctOptionKey: { type: String, default: "" },
    textAnswer: { type: String, default: "" },
    prompt: { type: String, default: "" },
  },
  { _id: false },
);

const ResultSchema = new Schema(
  {
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
      unique: true,
    },
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
    assessmentTitle: { type: String, required: true },
    objectiveScore: { type: Number, required: true, default: 0 },
    objectiveMaxMarks: { type: Number, required: true, default: 0 },
    subjectivePendingCount: { type: Number, required: true, default: 0 },
    subjectiveMaxMarks: { type: Number, required: true, default: 0 },
    totalMarks: { type: Number, required: true, default: 0 },
    questions: { type: [ResultQuestionSchema], default: [] },
    submittedAt: { type: Date, required: true },
    finalizedReason: {
      type: String,
      enum: ["submitted", "expired"],
      required: true,
    },
  },
  { timestamps: true },
);

ResultSchema.index({ studentId: 1, submittedAt: -1 });

export type ResultDocument = InferSchemaType<typeof ResultSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Result: Model<ResultDocument> =
  mongoose.models.Result ||
  mongoose.model<ResultDocument>("Result", ResultSchema);
