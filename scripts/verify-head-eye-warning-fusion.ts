/**
 * Phase E/F: independent eye-gaze warning + head/eye fusion.
 * Run: npx tsx scripts/verify-head-eye-warning-fusion.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  EYE_GAZE_MIN_CONFIDENCE,
  EYE_GAZE_PROLONGED_THRESHOLD_MS,
  EYE_GAZE_WARNING_THRESHOLD_MS,
} from "../src/lib/face/eye-gaze-constants";
import { computeEyeGazeWarningState } from "../src/lib/face/eye-gaze-warning";
import {
  HEAD_PROLONGED_THRESHOLD_MS,
  HEAD_WARNING_THRESHOLD_MS,
} from "../src/lib/face/head-pose-constants";
import {
  PROCTORING_ALERT_AUDIO_COOLDOWN_MS,
  PROCTORING_HEAD_WARNING_DISMISS_MS,
} from "../src/lib/proctoring/alert-audio";
import {
  fuseHeadEyeAttention,
  resolveAttentionOverlay,
} from "../src/lib/proctoring/head-eye-fusion";
import type { EyeGazeDirection } from "../src/types/eye-gaze";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function collectEyeEvents(
  samples: Array<{
    stableDirection: EyeGazeDirection;
    durationMs: number;
    confidence: number;
  }>,
) {
  const events: string[] = [];
  let warningLogged = false;
  let prolongedLogged = false;
  let episodeDir: string | null = null;

  for (const sample of samples) {
    const state = computeEyeGazeWarningState(sample);
    if (!state.away) {
      warningLogged = false;
      prolongedLogged = false;
      episodeDir = null;
      continue;
    }
    if (episodeDir !== state.direction) {
      warningLogged = false;
      prolongedLogged = false;
      episodeDir = state.direction;
    }
    if (state.tier >= 1 && !warningLogged) {
      warningLogged = true;
      events.push("EYE_GAZE_AWAY");
    }
    if (state.tier >= 2 && !prolongedLogged) {
      prolongedLogged = true;
      events.push("EYE_GAZE_AWAY_PROLONGED");
    }
  }
  return events;
}

function main() {
  assert(HEAD_WARNING_THRESHOLD_MS === 5_000, "head first warning remains 5s");
  assert(HEAD_PROLONGED_THRESHOLD_MS === 10_000, "head prolonged remains 10s");
  assert(PROCTORING_HEAD_WARNING_DISMISS_MS === 1_500, "dismiss remains 1.5s");
  assert(
    PROCTORING_ALERT_AUDIO_COOLDOWN_MS === 30_000,
    "audio cooldown remains 30s",
  );
  assert(
    EYE_GAZE_WARNING_THRESHOLD_MS === 5_000,
    "eye first warning is 5s (independent constant)",
  );
  assert(
    EYE_GAZE_PROLONGED_THRESHOLD_MS === 10_000,
    "eye prolonged is 10s (independent constant)",
  );

  const headConsts = read("src/lib/face/head-pose-constants.ts");
  assert(
    headConsts.includes("HEAD_WARNING_THRESHOLD_MS = 5_000"),
    "head constants file unchanged at 5s",
  );
  assert(
    !headConsts.includes("EYE_GAZE"),
    "eye timing is not mixed into head-pose-constants",
  );

  const detector = read("src/lib/face/head-pose-detector.ts");
  assert(
    (detector.match(/detectForVideo/g) || []).length === 1,
    "still exactly one detectForVideo() per sample",
  );

  const layout = read("src/app/layout.tsx");
  assert(layout.includes("Plus_Jakarta_Sans"), "layout font import untouched");

  const center = computeEyeGazeWarningState({
    stableDirection: "CENTER",
    durationMs: 20_000,
    confidence: 0.9,
  });
  assert(!center.active && center.tier === 0, "CENTER never warns");

  const unknown = computeEyeGazeWarningState({
    stableDirection: "UNKNOWN",
    durationMs: 20_000,
    confidence: 0.9,
  });
  assert(!unknown.active && unknown.tier === 0, "UNKNOWN never warns");

  const lowConf = computeEyeGazeWarningState({
    stableDirection: "LEFT",
    durationMs: 20_000,
    confidence: EYE_GAZE_MIN_CONFIDENCE - 0.01,
  });
  assert(!lowConf.active && !lowConf.away, "low confidence does not warn");

  const glance = computeEyeGazeWarningState({
    stableDirection: "LEFT",
    durationMs: 1_000,
    confidence: 0.9,
  });
  assert(glance.away && glance.tier === 0, "brief LEFT glance does not warn");

  const left5 = computeEyeGazeWarningState({
    stableDirection: "LEFT",
    durationMs: 5_000,
    confidence: 0.9,
  });
  assert(left5.active && left5.tier === 1, "head NORMAL + LEFT 5s → eye warning");

  const left10 = computeEyeGazeWarningState({
    stableDirection: "LEFT",
    durationMs: 10_000,
    confidence: 0.9,
  });
  assert(left10.tier === 2, "LEFT 10s → eye prolonged");

  const right5 = computeEyeGazeWarningState({
    stableDirection: "RIGHT",
    durationMs: 5_000,
    confidence: 0.9,
  });
  assert(right5.tier === 1, "RIGHT 5s → eye warning");

  const down5 = computeEyeGazeWarningState({
    stableDirection: "DOWN",
    durationMs: 5_000,
    confidence: 0.9,
  });
  assert(down5.tier === 1, "DOWN 5s → eye warning (same rule as LEFT/RIGHT)");

  const dirChangeEvents = collectEyeEvents([
    { stableDirection: "LEFT", durationMs: 3_000, confidence: 0.9 },
    { stableDirection: "RIGHT", durationMs: 2_000, confidence: 0.9 },
  ]);
  assert(
    dirChangeEvents.length === 0,
    "LEFT 3s then RIGHT 2s does not accumulate to 5s",
  );

  const storm = collectEyeEvents(
    [5_000, 5_500, 6_000, 6_500, 10_000, 10_500, 11_000].map((ms) => ({
      stableDirection: "LEFT" as const,
      durationMs: ms,
      confidence: 0.9,
    })),
  );
  assert(
    storm.join(",") === "EYE_GAZE_AWAY,EYE_GAZE_AWAY_PROLONGED",
    "one event per threshold crossing, not per sample",
  );

  const twoEpisodes = collectEyeEvents([
    { stableDirection: "LEFT", durationMs: 5_000, confidence: 0.9 },
    { stableDirection: "CENTER", durationMs: 2_000, confidence: 0.9 },
    { stableDirection: "LEFT", durationMs: 5_000, confidence: 0.9 },
  ]);
  assert(
    twoEpisodes.join(",") === "EYE_GAZE_AWAY,EYE_GAZE_AWAY",
    "returning to CENTER starts a new episode event",
  );

  const headOnly = fuseHeadEyeAttention({
    headStatus: "looking_away",
    headOrientation: "LEFT",
    headWarning: true,
    headWarningTier: 1,
    stableEyeDirection: "UNKNOWN",
    eyeAway: false,
    eyeWarningTier: 0,
    eyeConfidence: 0,
  });
  assert(
    headOnly.warningSource === "head" &&
      headOnly.combinedAttentionState === "HEAD_AWAY_EYES_CENTER_OR_UNKNOWN",
    "eye UNKNOWN does not suppress head warning",
  );

  const headProlongedEyeNull = fuseHeadEyeAttention({
    headStatus: "looking_away",
    headOrientation: "LEFT",
    headWarning: true,
    headWarningTier: 2,
    stableEyeDirection: "UNKNOWN",
    eyeAway: false,
    eyeWarningTier: 0,
    eyeConfidence: 0,
  });
  assert(
    headProlongedEyeNull.warningSource === "head" &&
      headProlongedEyeNull.warningTier === 2,
    "eye null/UNKNOWN isolation: head 10s prolonged still overlays",
  );

  const eyeOnly = fuseHeadEyeAttention({
    headStatus: "active",
    headOrientation: "NORMAL",
    headWarning: false,
    headWarningTier: 0,
    stableEyeDirection: "LEFT",
    eyeAway: true,
    eyeWarningTier: 1,
    eyeConfidence: 0.8,
  });
  assert(
    eyeOnly.warningSource === "eye" &&
      eyeOnly.combinedAttentionState === "HEAD_NORMAL_EYES_AWAY",
    "head NORMAL + eyes LEFT → eye-only overlay",
  );

  const both = fuseHeadEyeAttention({
    headStatus: "looking_away",
    headOrientation: "LEFT",
    headWarning: true,
    headWarningTier: 2,
    stableEyeDirection: "LEFT",
    eyeAway: true,
    eyeWarningTier: 2,
    eyeConfidence: 0.8,
  });
  assert(
    both.warningSource === "combined" && both.warningTier === 2,
    "head + eye away → single combined overlay, not two",
  );

  const disagree = fuseHeadEyeAttention({
    headStatus: "looking_away",
    headOrientation: "LEFT",
    headWarning: true,
    headWarningTier: 1,
    stableEyeDirection: "RIGHT",
    eyeAway: true,
    eyeWarningTier: 1,
    eyeConfidence: 0.8,
  });
  assert(
    disagree.disagree && disagree.warningSource === "head",
    "head/eye disagreement does not escalate; head first warning stays authoritative",
  );

  const overlayBothFirst = resolveAttentionOverlay(1, 1);
  assert(
    overlayBothFirst.source === "head",
    "head first warning outranks eye first warning",
  );

  const overlayEyeProlonged = resolveAttentionOverlay(1, 2);
  assert(
    overlayEyeProlonged.source === "eye" && overlayEyeProlonged.overlayTier === 2,
    "eye prolonged outranks head first warning",
  );

  const types = read("src/types/exam-security.ts");
  assert(types.includes('"EYE_GAZE_AWAY"'), "EYE_GAZE_AWAY registered");
  assert(
    types.includes('"EYE_GAZE_AWAY_PROLONGED"'),
    "EYE_GAZE_AWAY_PROLONGED registered",
  );
  assert(types.includes('"HEAD_LOOKING_LEFT"'), "head events remain registered");

  const ux = read("src/hooks/use-proctoring-head-warning-ux.ts");
  assert(ux.includes("blockedByHigherPriority"), "security banner still first");
  assert(ux.includes("playProctoringAlertTone"), "shared audio infrastructure");
  assert(
    ux.includes("PROCTORING_HEAD_WARNING_DISMISS_MS"),
    "shared 1.5s dismiss",
  );
  assert(
    ux.includes("Keep your eyes on the assessment screen"),
    "neutral first eye copy",
  );
  assert(!ux.includes("Cheating detected"), "copy does not accuse");

  const session = read("src/components/exam/exam-session-client.tsx");
  assert(session.includes("eyeWarning:"), "eye warning wired into overlay UX");
  assert(
    session.includes("blockedByHigherPriority: Boolean(warning)"),
    "tab/fullscreen/security banner still outranks overlay",
  );

  const panel = read("src/components/exam/eye-gaze-debug-panel.tsx");
  assert(
    panel.includes('NODE_ENV === "production"') && panel.includes("eyeTier"),
    "debug panel remains production-gated and shows warning tier",
  );

  console.log("\nHead + eye warning fusion checks passed.");
}

main();
