import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const AnswerSchema = new Schema(
  {
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    questionId: {
      type: Schema.Types.ObjectId,
      ref: "Question",
      required: true,
    },
    selectedOptionKey: {
      type: String,
      default: "",
      trim: true,
    },
    textAnswer: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

AnswerSchema.index({ attemptId: 1, questionId: 1 }, { unique: true });
AnswerSchema.index({ studentId: 1, attemptId: 1 });

export type AnswerDocument = InferSchemaType<typeof AnswerSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Answer: Model<AnswerDocument> =
  mongoose.models.Answer ||
  mongoose.model<AnswerDocument>("Answer", AnswerSchema);
