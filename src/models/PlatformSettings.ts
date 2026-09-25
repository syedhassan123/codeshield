import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/** Singleton document — always upserted with key: "global", enforced by
 * the unique index below. Never create a second document. */
const SINGLETON_KEY = "global";

const PlatformSecuritySchema = new Schema(
  {
    // Maps to Assessment.security.requireFaceDetection as the default for
    // newly created assessments (see src/lib/settings/queries.ts).
    enforceFaceVerification: { type: Boolean, default: true },
    // Maps to Assessment.security.monitorTabSwitching.
    blockTabSwitching: { type: Boolean, default: true },
    // Maps to Assessment.security.blockCopyPaste.
    disableCopyPaste: { type: Boolean, default: true },
    // Stored preference only — no enforcement engine exists yet for this.
    detectDevTools: { type: Boolean, default: true },
    // Stored preference only — no enforcement engine exists yet for this.
    autoSubmitAfterViolations: { type: Boolean, default: true },
    // Stored preference only — coding editor does not read this yet.
    allowPasteInCodingTest: { type: Boolean, default: false },
  },
  { _id: false },
);

const PlatformNotificationsSchema = new Schema(
  {
    // Stored preference only — no notification-delivery engine reads
    // these yet (SMTP is already used for OTP, but not for these alerts).
    emailAlerts: { type: Boolean, default: true },
    smsAlerts: { type: Boolean, default: false },
    webhookIntegrations: { type: Boolean, default: false },
    slackNotifications: { type: Boolean, default: true },
  },
  { _id: false },
);

const PlatformBrandingSchema = new Schema(
  {
    // Stored preference only — not yet applied to the actual UI theme.
    primaryColor: { type: String, default: "#4f55f3" },
    defaultLanguage: { type: String, default: "English" },
  },
  { _id: false },
);

const PlatformSettingsSchema = new Schema(
  {
    key: { type: String, default: SINGLETON_KEY, unique: true },
    organizationName: { type: String, default: "CodeShield Academy" },
    organizationDomain: { type: String, default: "codeshield.edu" },
    contactEmail: { type: String, default: "admin@codeshield.ai" },
    security: {
      type: PlatformSecuritySchema,
      default: () => ({}),
    },
    notifications: {
      type: PlatformNotificationsSchema,
      default: () => ({}),
    },
    branding: {
      type: PlatformBrandingSchema,
      default: () => ({}),
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true },
);

export type PlatformSettingsDocument = InferSchemaType<
  typeof PlatformSettingsSchema
> & {
  _id: mongoose.Types.ObjectId;
};

export const PlatformSettings: Model<PlatformSettingsDocument> =
  mongoose.models.PlatformSettings ||
  mongoose.model<PlatformSettingsDocument>(
    "PlatformSettings",
    PlatformSettingsSchema,
  );

export { SINGLETON_KEY as PLATFORM_SETTINGS_SINGLETON_KEY };
