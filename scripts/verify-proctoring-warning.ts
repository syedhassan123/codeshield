/**
 * Proctoring head-warning UX checks (no browser required).
 * Run: npx tsx scripts/verify-proctoring-warning.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  PROCTORING_ALERT_AUDIO_COOLDOWN_MS,
  PROCTORING_HEAD_WARNING_DISMISS_MS,
  playProctoringAlertTone,
  resetProctoringAlertAudioForTests,
} from "../src/lib/proctoring/alert-audio";
import { HEAD_WARNING_THRESHOLD_MS } from "../src/lib/face/head-pose-constants";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function main() {
  assert(PROCTORING_ALERT_AUDIO_COOLDOWN_MS >= 10_000, "audio cooldown configured");
  assert(PROCTORING_HEAD_WARNING_DISMISS_MS >= 500, "dismiss stabilization configured");
  assert(HEAD_WARNING_THRESHOLD_MS >= 5_000, "existing detection threshold preserved");

  const headHook = read("src/hooks/use-head-pose-monitoring.ts");
  assert(headHook.includes("HEAD_WARNING_THRESHOLD_MS"), "uses existing warning threshold");
  assert(headHook.includes("warningTier"), "warning tier exported for UX escalation");
  assert(
    !headHook.includes("playProctoringAlertTone"),
    "detection hook does not own audio UX",
  );

  const uxHook = read("src/hooks/use-proctoring-head-warning-ux.ts");
  assert(uxHook.includes("blockedByHigherPriority"), "priority over security banner");
  assert(uxHook.includes("playProctoringAlertTone"), "UX layer owns audio alert");
  assert(uxHook.includes("PROCTORING_HEAD_WARNING_DISMISS_MS"), "auto-dismiss stabilization");

  const overlay = read("src/components/exam/proctoring-head-warning-overlay.tsx");
  assert(overlay.includes('role="alert"'), "accessible alert role");
  assert(overlay.includes("pointer-events-none"), "non-blocking overlay wrapper");

  const session = read("src/components/exam/exam-session-client.tsx");
  assert(session.includes("ProctoringHeadWarningOverlay"), "overlay wired in exam session");
  assert(session.includes("useProctoringHeadWarningUx"), "UX hook wired in exam session");
  assert(session.includes("unlockProctoringAlertAudio"), "audio unlock on exam interaction");
  assert(
    session.includes("blockedByHigherPriority: Boolean(warning)"),
    "security banner takes priority",
  );

  resetProctoringAlertAudioForTests();
  assert(typeof playProctoringAlertTone() === "boolean", "audio play fails gracefully server-side");

  const security = read("src/lib/actions/exam-security.ts");
  assert(security.includes("recordExamSecurityEventAction"), "SecurityEvent path unchanged");

  console.log("\nProctoring head-warning UX checks passed.");
}

main();
