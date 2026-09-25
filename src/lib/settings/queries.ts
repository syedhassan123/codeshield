import mongoose from "mongoose";
import {
  PLATFORM_SETTINGS_SINGLETON_KEY,
  PlatformSettings,
} from "@/models/PlatformSettings";
import {
  DEFAULT_ASSESSMENT_SECURITY,
  type AssessmentSecuritySettings,
} from "@/types/assessment-security";

export type SerializedPlatformSettings = {
  organizationName: string;
  organizationDomain: string;
  contactEmail: string;
  security: {
    enforceFaceVerification: boolean;
    blockTabSwitching: boolean;
    disableCopyPaste: boolean;
    detectDevTools: boolean;
    autoSubmitAfterViolations: boolean;
    allowPasteInCodingTest: boolean;
  };
  notifications: {
    emailAlerts: boolean;
    smsAlerts: boolean;
    webhookIntegrations: boolean;
    slackNotifications: boolean;
  };
  branding: {
    primaryColor: string;
    defaultLanguage: string;
  };
  updatedAt: string | null;
};

/** Matches the Mongoose schema defaults — used when no document exists yet
 * (fresh install) so the page never has to special-case "not configured". */
const FALLBACK_SETTINGS: SerializedPlatformSettings = {
  organizationName: "CodeShield Academy",
  organizationDomain: "codeshield.edu",
  contactEmail: "admin@codeshield.ai",
  security: {
    enforceFaceVerification: true,
    blockTabSwitching: true,
    disableCopyPaste: true,
    detectDevTools: true,
    autoSubmitAfterViolations: true,
    allowPasteInCodingTest: false,
  },
  notifications: {
    emailAlerts: true,
    smsAlerts: false,
    webhookIntegrations: false,
    slackNotifications: true,
  },
  branding: {
    primaryColor: "#4f55f3",
    defaultLanguage: "English",
  },
  updatedAt: null,
};

export async function getPlatformSettings(): Promise<SerializedPlatformSettings> {
  const doc = await PlatformSettings.findOne({
    key: PLATFORM_SETTINGS_SINGLETON_KEY,
  });
  if (!doc) return FALLBACK_SETTINGS;

  return {
    organizationName: doc.organizationName ?? FALLBACK_SETTINGS.organizationName,
    organizationDomain:
      doc.organizationDomain ?? FALLBACK_SETTINGS.organizationDomain,
    contactEmail: doc.contactEmail ?? FALLBACK_SETTINGS.contactEmail,
    security: {
      enforceFaceVerification:
        doc.security?.enforceFaceVerification ??
        FALLBACK_SETTINGS.security.enforceFaceVerification,
      blockTabSwitching:
        doc.security?.blockTabSwitching ??
        FALLBACK_SETTINGS.security.blockTabSwitching,
      disableCopyPaste:
        doc.security?.disableCopyPaste ??
        FALLBACK_SETTINGS.security.disableCopyPaste,
      detectDevTools:
        doc.security?.detectDevTools ?? FALLBACK_SETTINGS.security.detectDevTools,
      autoSubmitAfterViolations:
        doc.security?.autoSubmitAfterViolations ??
        FALLBACK_SETTINGS.security.autoSubmitAfterViolations,
      allowPasteInCodingTest:
        doc.security?.allowPasteInCodingTest ??
        FALLBACK_SETTINGS.security.allowPasteInCodingTest,
    },
    notifications: {
      emailAlerts:
        doc.notifications?.emailAlerts ??
        FALLBACK_SETTINGS.notifications.emailAlerts,
      smsAlerts:
        doc.notifications?.smsAlerts ?? FALLBACK_SETTINGS.notifications.smsAlerts,
      webhookIntegrations:
        doc.notifications?.webhookIntegrations ??
        FALLBACK_SETTINGS.notifications.webhookIntegrations,
      slackNotifications:
        doc.notifications?.slackNotifications ??
        FALLBACK_SETTINGS.notifications.slackNotifications,
    },
    branding: {
      primaryColor: doc.branding?.primaryColor ?? FALLBACK_SETTINGS.branding.primaryColor,
      defaultLanguage:
        doc.branding?.defaultLanguage ?? FALLBACK_SETTINGS.branding.defaultLanguage,
    },
    updatedAt: (doc as { updatedAt?: Date }).updatedAt
      ? new Date((doc as { updatedAt?: Date }).updatedAt!).toISOString()
      : null,
  };
}

export type SavePlatformSettingsInput = {
  organizationName: string;
  organizationDomain: string;
  contactEmail: string;
  security: SerializedPlatformSettings["security"];
  notifications: SerializedPlatformSettings["notifications"];
  branding: SerializedPlatformSettings["branding"];
};

/** Upsert-only, always targeting the fixed singleton key — this can never
 * create a second settings document, by construction. */
export async function savePlatformSettings(
  input: SavePlatformSettingsInput,
  adminId: string,
): Promise<SerializedPlatformSettings> {
  await PlatformSettings.findOneAndUpdate(
    { key: PLATFORM_SETTINGS_SINGLETON_KEY },
    {
      $set: {
        organizationName: input.organizationName,
        organizationDomain: input.organizationDomain,
        contactEmail: input.contactEmail,
        security: input.security,
        notifications: input.notifications,
        branding: input.branding,
        updatedBy: new mongoose.Types.ObjectId(adminId),
      },
      $setOnInsert: { key: PLATFORM_SETTINGS_SINGLETON_KEY },
    },
    { upsert: true },
  );

  return getPlatformSettings();
}

/**
 * Bridges the 3 platform security toggles that have a direct real
 * equivalent on Assessment.security to the default used when an admin
 * creates a new assessment without specifying security explicitly (the
 * assessment form has no security UI today, so this fallback always
 * applies). `requireCamera`, `requireFullscreen`, and
 * `requireHeadMonitoring` have no settings-page equivalent and stay at
 * their hardcoded DEFAULT_ASSESSMENT_SECURITY values.
 */
export async function getPlatformSecurityDefaults(): Promise<AssessmentSecuritySettings> {
  const settings = await getPlatformSettings();
  return {
    ...DEFAULT_ASSESSMENT_SECURITY,
    requireFaceDetection: settings.security.enforceFaceVerification,
    monitorTabSwitching: settings.security.blockTabSwitching,
    blockCopyPaste: settings.security.disableCopyPaste,
  };
}
