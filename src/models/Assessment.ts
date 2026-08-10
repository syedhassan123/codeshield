import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TYPES,
  DIFFICULTIES,
  QUESTION_CATEGORIES,
} from "@/types/assessment";

const AssessmentSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    instructions: {
      type: String,
      default: "",
      trim: true,
    },
    type: {
      type: String,
      enum: ASSESSMENT_TYPES,
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
    status: {
      type: String,
      enum: ASSESSMENT_STATUSES,
      default: "draft",
    },
    durationMin: {
      type: Number,
      required: true,
      min: 1,
    },
    totalMarks: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    questionIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Question",
      },
    ],
    /** all = every student; assigned = only assignedStudentIds */
    visibility: {
      type: String,
      enum: ["all", "assigned"],
      default: "all",
    },
    assignedStudentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    scheduledAt: {
      type: Date,
      default: null,
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true },
);

AssessmentSchema.index({ status: 1, visibility: 1 });
AssessmentSchema.index({ title: "text", description: "text" });

export type AssessmentDocument = InferSchemaType<typeof AssessmentSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Assessment: Model<AssessmentDocument> =
  mongoose.models.Assessment ||
  mongoose.model<AssessmentDocument>("Assessment", AssessmentSchema);
