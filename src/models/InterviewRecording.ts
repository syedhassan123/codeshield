import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  INTERVIEW_RECORDING_MODES,
  INTERVIEW_RECORDING_STATUSES,
} from "@/types/interview-recording";

const InterviewRecordingSchema = new Schema(
  {
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: INTERVIEW_RECORDING_STATUSES,
      default: "RECORDING",
      required: true,
      index: true,
    },
    mode: {
      type: String,
      enum: INTERVIEW_RECORDING_MODES,
      required: true,
    },
    egressId: {
      type: String,
      default: "",
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
      default: "video/mp4",
    },
    startedAt: {
      type: Date,
      required: true,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    sizeBytes: {
      type: Number,
      default: 0,
      min: 0,
    },
    errorMessage: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

InterviewRecordingSchema.index(
  { interviewId: 1 },
  {
    unique: true,
    name: "interviewId_active_recording_unique",
    partialFilterExpression: {
      status: { $in: ["RECORDING", "UPLOADING"] },
    },
  },
);

InterviewRecordingSchema.index({ interviewId: 1, createdAt: -1 });

export type InterviewRecordingDocument = InferSchemaType<
  typeof InterviewRecordingSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const InterviewRecording: Model<InterviewRecordingDocument> =
  mongoose.models.InterviewRecording ||
  mongoose.model<InterviewRecordingDocument>(
    "InterviewRecording",
    InterviewRecordingSchema,
  );
