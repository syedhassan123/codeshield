import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  CODING_LANGUAGES,
  DIFFICULTIES,
  QUESTION_CATEGORIES,
  QUESTION_TYPES,
} from "@/types/assessment";

const McqOptionSchema = new Schema(
  {
    key: { type: String, required: true },
    text: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const CodingTestCaseSchema = new Schema(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: false },
  },
  { _id: false },
);

const QuestionSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    prompt: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: QUESTION_TYPES,
      required: true,
    },
    category: {
      type: String,
      enum: QUESTION_CATEGORIES,
      required: true,
    },
    difficulty: {
      type: String,
      enum: DIFFICULTIES,
      required: true,
    },
    points: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    explanation: {
      type: String,
      default: "",
      trim: true,
    },
    options: {
      type: [McqOptionSchema],
      default: [],
    },
    correctOptionKey: {
      type: String,
      default: "",
    },
    codingLanguages: {
      type: [{ type: String, enum: CODING_LANGUAGES }],
      default: [],
    },
    starterCode: {
      type: Schema.Types.Mixed,
      default: {},
    },
    testCases: {
      type: [CodingTestCaseSchema],
      default: [],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

QuestionSchema.index({ category: 1, type: 1, difficulty: 1 });
QuestionSchema.index({ prompt: "text" });

export type QuestionDocument = InferSchemaType<typeof QuestionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Question: Model<QuestionDocument> =
  mongoose.models.Question ||
  mongoose.model<QuestionDocument>("Question", QuestionSchema);
