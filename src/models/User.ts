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
  },
  {
    timestamps: true,
  },
);

export type UserDocument = InferSchemaType<typeof UserSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);

export type { UserRole, UserStatus } from "@/types/user";
export { USER_ROLES, USER_STATUSES } from "@/types/user";
