import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const EmailOtpSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
    consumedAt: {
      type: Date,
      default: null,
    },
    lastSentAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

EmailOtpSchema.index({ email: 1, createdAt: -1 });
EmailOtpSchema.index({ expiresAt: 1 });

export type EmailOtpDocument = InferSchemaType<typeof EmailOtpSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const EmailOtp: Model<EmailOtpDocument> =
  mongoose.models.EmailOtp ||
  mongoose.model<EmailOtpDocument>("EmailOtp", EmailOtpSchema);
