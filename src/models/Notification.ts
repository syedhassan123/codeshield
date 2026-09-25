import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * In-app notifications only (Phase 20). Deliberately separate from the
 * Phase 18 PlatformSettings notification toggles (emailAlerts, smsAlerts,
 * webhookIntegrations, slackNotifications) — those remain stored-only
 * preferences with no external delivery integration. This is a different,
 * additive feature: real events, delivered in-app, to the actual user.
 */
export const NOTIFICATION_TYPES = [
  "CERTIFICATE_ISSUED",
  "CERTIFICATE_REVOKED",
  "RESULT_READY",
  "INTERVIEW_SCHEDULED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const NotificationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    /** Relative in-app link to navigate to on click, e.g. /student/certificates/xyz */
    link: { type: String, default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, read: 1 });

export type NotificationDocument = InferSchemaType<
  typeof NotificationSchema
> & {
  _id: mongoose.Types.ObjectId;
};

function getNotificationModel(): Model<NotificationDocument> {
  const cached = mongoose.models.Notification as
    | Model<NotificationDocument>
    | undefined;
  if (cached) return cached;
  return mongoose.model<NotificationDocument>(
    "Notification",
    NotificationSchema,
  );
}

export const Notification: Model<NotificationDocument> =
  getNotificationModel();
