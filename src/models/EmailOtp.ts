import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const OTP_PURPOSES = ["registration", "login"] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

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
    purpose: {
      type: String,
      enum: OTP_PURPOSES,
      default: "login",
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

EmailOtpSchema.index({ email: 1, purpose: 1, createdAt: -1 });
EmailOtpSchema.index({ expiresAt: 1 });

export type EmailOtpDocument = InferSchemaType<typeof EmailOtpSchema> & {
  _id: mongoose.Types.ObjectId;
};

function getEmailOtpModel(): Model<EmailOtpDocument> {
  const cached = mongoose.models.EmailOtp as Model<EmailOtpDocument> | undefined;
  if (cached) {
    if (!cached.schema.path("purpose")) {
      mongoose.deleteModel("EmailOtp");
    } else {
      return cached;
    }
  }
  return mongoose.model<EmailOtpDocument>("EmailOtp", EmailOtpSchema);
}

export const EmailOtp: Model<EmailOtpDocument> = getEmailOtpModel();
