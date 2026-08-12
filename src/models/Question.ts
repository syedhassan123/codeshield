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

const CodingExampleSchema = new Schema(
  {
    input: { type: String, default: "" },
    output: { type: String, default: "" },
    explanation: { type: String, default: "" },
  },
  { _id: false },
);

const CodingTestCaseSchema = new Schema(
  {
    input: { type: String, required: true },
    expectedOutput: { type: String, required: true },
    isHidden: { type: Boolean, default: false },
    weight: { type: Number, default: 1, min: 0 },
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
    /** Coding problem metadata (prompt remains the main statement). */
    constraints: { type: String, default: "" },
    inputFormat: { type: String, default: "" },
    outputFormat: { type: String, default: "" },
    examples: { type: [CodingExampleSchema], default: [] },
    timeLimitMs: { type: Number, default: 3000, min: 100, max: 15000 },
    memoryLimitMb: { type: Number, default: 256, min: 32, max: 1024 },
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

function getQuestionModel(): Model<QuestionDocument> {
  const cached = mongoose.models.Question as Model<QuestionDocument> | undefined;
  if (cached) {
    if (!cached.schema.path("timeLimitMs")) {
      mongoose.deleteModel("Question");
    } else {
      return cached;
    }
  }
  return mongoose.model<QuestionDocument>("Question", QuestionSchema);
}

export const Question: Model<QuestionDocument> = getQuestionModel();
