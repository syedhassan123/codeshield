import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { INTERVIEW_EVALUATION_STATUSES } from "@/types/interview-evaluation";

const InterviewEvaluationSchema = new Schema(
  {
    interviewId: {
      type: Schema.Types.ObjectId,
      ref: "Interview",
      required: true,
      unique: true,
    },
    interviewerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    candidateId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    notes: {
      type: String,
      default: "",
      maxlength: 5000,
    },
    status: {
      type: String,
      enum: INTERVIEW_EVALUATION_STATUSES,
      default: "submitted",
      required: true,
    },
    submittedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

InterviewEvaluationSchema.index({ interviewerId: 1, submittedAt: -1 });

export type InterviewEvaluationDocument = InferSchemaType<
  typeof InterviewEvaluationSchema
> & {
  _id: mongoose.Types.ObjectId;
};

function getInterviewEvaluationModel(): Model<InterviewEvaluationDocument> {
  const cached = mongoose.models.InterviewEvaluation as
    | Model<InterviewEvaluationDocument>
    | undefined;
  if (cached) {
    return cached;
  }
  return mongoose.model<InterviewEvaluationDocument>(
    "InterviewEvaluation",
    InterviewEvaluationSchema,
  );
}

export const InterviewEvaluation: Model<InterviewEvaluationDocument> =
  getInterviewEvaluationModel();

export {
  INTERVIEW_EVALUATION_STATUSES,
} from "@/types/interview-evaluation";
export type { InterviewEvaluationStatus } from "@/types/interview-evaluation";
