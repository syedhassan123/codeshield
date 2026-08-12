import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { USER_ROLES, USER_STATUSES } from "@/types/user";

const UserSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "active",
    },
    avatar: {
      type: String,
      default: "",
    },
    course: {
      type: String,
      default: "",
    },
    year: {
      type: String,
      default: "",
    },
    faceVerifiedAt: {
      type: Date,
      default: null,
    },
    /**
     * Set true after registration email OTP succeeds.
     * Legacy documents without this field are treated as verified at login time.
     */
    emailVerified: {
      type: Boolean,
      default: false,
    },
    /** Set when login email OTP succeeds for the current login; JWT sync checks vs authTime. */
    otpLoginVerifiedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

function getUserModel(): Model<UserDocument> {
  const cached = mongoose.models.User as Model<UserDocument> | undefined;
  if (cached) {
    // Hot-reload can keep a stale schema without newer fields.
    if (
      !cached.schema.path("otpLoginVerifiedAt") ||
      !cached.schema.path("emailVerified")
    ) {
      mongoose.deleteModel("User");
    } else {
      return cached;
    }
  }
  return mongoose.model<UserDocument>("User", UserSchema);
}

export const User: Model<UserDocument> = getUserModel();

export type { UserRole, UserStatus } from "@/types/user";
export { USER_ROLES, USER_STATUSES } from "@/types/user";
