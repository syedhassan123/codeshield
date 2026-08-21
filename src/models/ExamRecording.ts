import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { RECORDING_STATUSES } from "@/types/exam-recording";

const ExamRecordingSchema = new Schema(
  {
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
      index: true,
    },
    userId: {
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
    storageKey: {
      type: String,
      required: true,
    },
    storageProvider: {
      type: String,
      enum: ["local", "s3"],
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    fileSizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: RECORDING_STATUSES,
      default: "RECORDING",
      required: true,
      index: true,
    },
    errorMessage: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

ExamRecordingSchema.index({ attemptId: 1, createdAt: -1 });
ExamRecordingSchema.index(
  { attemptId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "RECORDING" },
  },
);

export type ExamRecordingDocument = InferSchemaType<
  typeof ExamRecordingSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const ExamRecording: Model<ExamRecordingDocument> =
  mongoose.models.ExamRecording ||
  mongoose.model<ExamRecordingDocument>("ExamRecording", ExamRecordingSchema);
