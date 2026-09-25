/**
 * Phase 18 checks: real persistence for /admin/settings, replacing the
 * fully decorative defaultValue/defaultChecked UI + dead "Save" button.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase18-platform-settings.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  getPlatformSecurityDefaults,
  getPlatformSettings,
  savePlatformSettings,
} from "../src/lib/settings/queries";
import {
  PLATFORM_SETTINGS_SINGLETON_KEY,
  PlatformSettings,
} from "../src/models/PlatformSettings";
import { DEFAULT_ASSESSMENT_SECURITY } from "../src/types/assessment-security";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

function staticChecks() {
  const page = read("src/app/admin/settings/page.tsx");
  assert(
    page.includes("getPlatformSettings"),
    "settings page loads real persisted settings",
  );
  assert(
    page.includes('requirePageRole(["admin"])'),
    "settings page is admin-gated",
  );

  const client = read("src/components/admin/admin-settings-client.tsx");
  assert(
    !client.includes("defaultChecked") && !client.includes("defaultValue"),
    "settings client uses controlled inputs, not decorative defaultChecked/defaultValue",
  );
  assert(
    client.includes("saveAdminSettingsAction"),
    "Save button calls the real save action",
  );

  const actions = read("src/lib/actions/settings.ts");
  assert(
    actions.includes("requireAdmin"),
    "settings actions require an admin session",
  );

  const model = read("src/models/PlatformSettings.ts");
  assert(
    /key:\s*\{[\s\S]*?unique:\s*true/.test(model),
    "PlatformSettings.key has a unique DB-level index (enforces singleton)",
  );

  const assessmentsAction = read("src/lib/actions/assessments.ts");
  assert(
    assessmentsAction.includes("getPlatformSecurityDefaults"),
    "createAssessmentAction wires platform security defaults into new assessments",
  );
}

async function dbChecks() {
  await connectDB();

  const admin = await User.findOne({ email: "admin@codeshield.ai" }).lean();
  assert(admin?._id, "seed admin exists");

  // Clean slate for a deterministic run.
  await PlatformSettings.deleteMany({ key: PLATFORM_SETTINGS_SINGLETON_KEY });

  // 1) No document yet -> fallback defaults, not a crash.
  const beforeSave = await getPlatformSettings();
  assert(
    beforeSave.organizationName === "CodeShield Academy",
    "reading settings before any save returns sane fallback defaults",
  );

  // 2) Save -> persists and reloads with the saved values.
  const saved = await savePlatformSettings(
    {
      organizationName: "Verify Academy",
      organizationDomain: "verify.edu",
      contactEmail: "ops@verify.edu",
      security: {
        enforceFaceVerification: false,
        blockTabSwitching: false,
        disableCopyPaste: false,
        detectDevTools: true,
        autoSubmitAfterViolations: true,
        allowPasteInCodingTest: true,
      },
      notifications: {
        emailAlerts: false,
        smsAlerts: true,
        webhookIntegrations: true,
        slackNotifications: false,
      },
      branding: { primaryColor: "#112233", defaultLanguage: "Hindi" },
    },
    admin!._id.toString(),
  );
  assert(saved.organizationName === "Verify Academy", "save persists organization fields");
  assert(saved.security.enforceFaceVerification === false, "save persists security toggles");
  assert(saved.branding.defaultLanguage === "Hindi", "save persists branding");
  assert(!!saved.updatedAt, "save stamps updatedAt");

  const reloaded = await getPlatformSettings();
  assert(
    reloaded.organizationDomain === "verify.edu",
    "settings survive a fresh read after save (not just returned in-memory)",
  );

  // 3) Singleton — saving twice never creates a second document.
  await savePlatformSettings(
    {
      organizationName: "Verify Academy 2",
      organizationDomain: "verify.edu",
      contactEmail: "ops@verify.edu",
      security: reloaded.security,
      notifications: reloaded.notifications,
      branding: reloaded.branding,
    },
    admin!._id.toString(),
  );
  const docCount = await PlatformSettings.countDocuments({
    key: PLATFORM_SETTINGS_SINGLETON_KEY,
  });
  assert(docCount === 1, "saving twice never creates a second settings document");

  // 4) The 3 wired security toggles bridge correctly; unmapped fields stay
  // at the hardcoded DEFAULT_ASSESSMENT_SECURITY values.
  const secDefaults = await getPlatformSecurityDefaults();
  assert(
    secDefaults.requireFaceDetection === false,
    "enforceFaceVerification=false bridges to requireFaceDetection=false",
  );
  assert(
    secDefaults.monitorTabSwitching === false,
    "blockTabSwitching=false bridges to monitorTabSwitching=false",
  );
  assert(
    secDefaults.blockCopyPaste === false,
    "disableCopyPaste=false bridges to blockCopyPaste=false",
  );
  assert(
    secDefaults.requireCamera === DEFAULT_ASSESSMENT_SECURITY.requireCamera &&
      secDefaults.requireFullscreen ===
        DEFAULT_ASSESSMENT_SECURITY.requireFullscreen &&
      secDefaults.requireHeadMonitoring ===
        DEFAULT_ASSESSMENT_SECURITY.requireHeadMonitoring,
    "unmapped security fields stay at their hardcoded defaults, untouched by platform settings",
  );

  // 5) Flip the toggles back on and confirm the bridge reflects the change.
  await savePlatformSettings(
    {
      organizationName: reloaded.organizationName,
      organizationDomain: reloaded.organizationDomain,
      contactEmail: reloaded.contactEmail,
      security: {
        ...reloaded.security,
        enforceFaceVerification: true,
        blockTabSwitching: true,
        disableCopyPaste: true,
      },
      notifications: reloaded.notifications,
      branding: reloaded.branding,
    },
    admin!._id.toString(),
  );
  const secDefaultsAfter = await getPlatformSecurityDefaults();
  assert(
    secDefaultsAfter.requireFaceDetection === true &&
      secDefaultsAfter.monitorTabSwitching === true &&
      secDefaultsAfter.blockCopyPaste === true,
    "flipping toggles back on is reflected live in the next assessment's defaults",
  );

  // Clean up — restore a fresh/default state for the next run.
  await PlatformSettings.deleteMany({ key: PLATFORM_SETTINGS_SINGLETON_KEY });
}

async function main() {
  console.log("Phase 18 platform settings verification\n");
  staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 18 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
