import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const CERTIFICATE_STATUSES = ["issued", "revoked"] as const;
export type CertificateStatus = (typeof CERTIFICATE_STATUSES)[number];

const CertificateSchema = new Schema(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    /**
     * One certificate per passing Result (Phase 16 retake policy: retakers
     * accumulate one certificate per passing attempt, not one-per-assessment).
     * Unique index is the real idempotency guard — issuance code treats a
     * duplicate-key error as "already issued" rather than racing on an
     * application-level existence check.
     */
    resultId: {
      type: Schema.Types.ObjectId,
      ref: "Result",
      required: true,
      unique: true,
    },
    attemptId: {
      type: Schema.Types.ObjectId,
      ref: "Attempt",
      required: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: "Assessment",
      required: true,
      index: true,
    },
    assessmentTitle: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    passThreshold: { type: Number, required: true, min: 0, max: 100 },
    /**
     * Non-sequential, cryptographically random serial. Never derive this
     * from an incrementing counter or the Mongo _id — a guessable serial
     * would let someone enumerate other students' certificates.
     */
    certificateSerial: {
      type: String,
      required: true,
      unique: true,
    },
    issuedAt: { type: Date, required: true, default: Date.now },
    status: {
      type: String,
      enum: CERTIFICATE_STATUSES,
      default: "issued",
      required: true,
    },
    revokedAt: { type: Date, default: null },
    revokedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    revokedReason: { type: String, default: "" },
  },
  { timestamps: true },
);

CertificateSchema.index({ studentId: 1, issuedAt: -1 });

export type CertificateDocument = InferSchemaType<typeof CertificateSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Certificate: Model<CertificateDocument> =
  mongoose.models.Certificate ||
  mongoose.model<CertificateDocument>("Certificate", CertificateSchema);
