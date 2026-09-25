import { z } from "zod";

export const savePlatformSettingsSchema = z.object({
  organizationName: z.string().trim().min(1, "Organization name is required.").max(200),
  organizationDomain: z.string().trim().min(1, "Domain is required.").max(200),
  contactEmail: z.string().trim().email("Enter a valid email address."),
  security: z.object({
    enforceFaceVerification: z.boolean(),
    blockTabSwitching: z.boolean(),
    disableCopyPaste: z.boolean(),
    detectDevTools: z.boolean(),
    autoSubmitAfterViolations: z.boolean(),
    allowPasteInCodingTest: z.boolean(),
  }),
  notifications: z.object({
    emailAlerts: z.boolean(),
    smsAlerts: z.boolean(),
    webhookIntegrations: z.boolean(),
    slackNotifications: z.boolean(),
  }),
  branding: z.object({
    primaryColor: z
      .string()
      .trim()
      .regex(/^#[0-9a-fA-F]{6}$/, "Primary color must be a hex color like #4f55f3."),
    defaultLanguage: z.enum(["English", "Hindi", "Spanish", "French"]),
  }),
});

export type SavePlatformSettingsInput = z.infer<typeof savePlatformSettingsSchema>;
