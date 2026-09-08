import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
} from "@/types/interview";

const InterviewSchema = new Schema(
  {
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    interviewerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: INTERVIEW_TYPES,
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
    },
    durationMin: {
      type: Number,
      required: true,
      min: 1,
      max: 480,
    },
    status: {
      type: String,
      enum: INTERVIEW_STATUSES,
      default: "scheduled",
      required: true,
    },
    meetingUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

InterviewSchema.index({ interviewerId: 1, scheduledAt: -1 });
InterviewSchema.index({ interviewerId: 1, status: 1, scheduledAt: 1 });
InterviewSchema.index({ candidateId: 1, scheduledAt: -1 });

export type InterviewDocument = InferSchemaType<typeof InterviewSchema> & {
  _id: mongoose.Types.ObjectId;
};

function getInterviewModel(): Model<InterviewDocument> {
  const cached = mongoose.models.Interview as Model<InterviewDocument> | undefined;
  if (cached) {
    return cached;
  }
  return mongoose.model<InterviewDocument>("Interview", InterviewSchema);
}

export const Interview: Model<InterviewDocument> = getInterviewModel();

export {
  INTERVIEW_STATUSES,
  INTERVIEW_TYPES,
} from "@/types/interview";
export type { InterviewStatus, InterviewType } from "@/types/interview";
