import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TYPES,
  DIFFICULTIES,
  QUESTION_CATEGORIES,
} from "@/types/assessment";
import { DEFAULT_ASSESSMENT_SECURITY } from "@/types/assessment-security";

const AssessmentSecuritySchema = new Schema(
  {
    requireCamera: {
      type: Boolean,
      default: DEFAULT_ASSESSMENT_SECURITY.requireCamera,
    },
    requireFullscreen: {
      type: Boolean,
      default: DEFAULT_ASSESSMENT_SECURITY.requireFullscreen,
    },
    blockCopyPaste: {
      type: Boolean,
      default: DEFAULT_ASSESSMENT_SECURITY.blockCopyPaste,
    },
    monitorTabSwitching: {
      type: Boolean,
      default: DEFAULT_ASSESSMENT_SECURITY.monitorTabSwitching,
    },
  },
  { _id: false },
);

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
    security: {
      type: AssessmentSecuritySchema,
      default: () => ({ ...DEFAULT_ASSESSMENT_SECURITY }),
    },
  },
  { timestamps: true },
);

AssessmentSchema.index({ status: 1, visibility: 1 });
AssessmentSchema.index({ title: "text", description: "text" });

export type AssessmentDocument = InferSchemaType<typeof AssessmentSchema> & {
  _id: mongoose.Types.ObjectId;
};

function getAssessmentModel(): Model<AssessmentDocument> {
  const cached = mongoose.models.Assessment as
    | Model<AssessmentDocument>
    | undefined;
  if (cached) {
    if (!cached.schema.path("security")) {
      mongoose.deleteModel("Assessment");
    } else {
      return cached;
    }
  }
  return mongoose.model<AssessmentDocument>("Assessment", AssessmentSchema);
}

export const Assessment: Model<AssessmentDocument> = getAssessmentModel();
