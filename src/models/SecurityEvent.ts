import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import {
  SECURITY_EVENT_TYPES,
  SECURITY_SEVERITIES,
} from "@/types/exam-security";

const SecurityEventSchema = new Schema(
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
    eventType: {
      type: String,
      enum: SECURITY_EVENT_TYPES,
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: SECURITY_SEVERITIES,
      required: true,
    },
    /** Server-side timestamp when the event was recorded. */
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true },
);

SecurityEventSchema.index({ attemptId: 1, timestamp: -1 });
SecurityEventSchema.index({ attemptId: 1, eventType: 1, timestamp: -1 });

export type SecurityEventDocument = InferSchemaType<
  typeof SecurityEventSchema
> & {
  _id: mongoose.Types.ObjectId;
};

function getSecurityEventModel(): Model<SecurityEventDocument> {
  const cached = mongoose.models.SecurityEvent as
    | Model<SecurityEventDocument>
    | undefined;
  if (cached) return cached;
  return mongoose.model<SecurityEventDocument>(
    "SecurityEvent",
    SecurityEventSchema,
  );
}

export const SecurityEvent: Model<SecurityEventDocument> =
  getSecurityEventModel();
