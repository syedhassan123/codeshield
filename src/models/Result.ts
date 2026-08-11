import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { ANSWER_EVAL_STATUSES, EVALUATION_STATUSES } from "@/types/exam";

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
    feedback: { type: String, default: "" },
    gradedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    gradedAt: {
      type: Date,
      default: null,
    },
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
    subjectiveScore: { type: Number, required: true, default: 0 },
    subjectiveMaxMarks: { type: Number, required: true, default: 0 },
    codingScore: { type: Number, required: true, default: 0 },
    codingMaxMarks: { type: Number, required: true, default: 0 },
    subjectivePendingCount: { type: Number, required: true, default: 0 },
    finalScore: { type: Number, required: true, default: 0 },
    totalMarks: { type: Number, required: true, default: 0 },
    evaluationStatus: {
      type: String,
      enum: EVALUATION_STATUSES,
      default: "pending",
      required: true,
      index: true,
    },
    questions: { type: [ResultQuestionSchema], default: [] },
    submittedAt: { type: Date, required: true },
    finalizedReason: {
      type: String,
      enum: ["submitted", "expired"],
      required: true,
    },
    lastGradedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    lastGradedAt: {
      type: Date,
      default: null,
    },
    evaluationCompletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

ResultSchema.index({ studentId: 1, submittedAt: -1 });
ResultSchema.index({ assessmentId: 1, evaluationStatus: 1, submittedAt: -1 });
ResultSchema.index({ evaluationStatus: 1, submittedAt: -1 });

export type ResultDocument = InferSchemaType<typeof ResultSchema> & {
  _id: mongoose.Types.ObjectId;
};

function getResultModel(): Model<ResultDocument> {
  const cached = mongoose.models.Result as Model<ResultDocument> | undefined;
  if (cached) {
    // Next.js hot-reload can keep a stale schema without newer enum values.
    const questionsPath = cached.schema.path("questions") as
      | (mongoose.Schema.Types.DocumentArray & {
          schema?: mongoose.Schema;
        })
      | undefined;
    const evalEnum =
      (
        questionsPath?.schema?.path("evalStatus") as
          | { options?: { enum?: string[] } }
          | undefined
      )?.options?.enum ?? [];
    if (!evalEnum.includes("manually_graded")) {
      mongoose.deleteModel("Result");
    } else {
      return cached;
    }
  }
  return mongoose.model<ResultDocument>("Result", ResultSchema);
}

export const Result: Model<ResultDocument> = getResultModel();
