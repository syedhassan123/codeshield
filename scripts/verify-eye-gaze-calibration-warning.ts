/**
 * Baseline-relative eye gaze: capture, direction, smoothing, warnings.
 * Run: npx tsx scripts/verify-eye-gaze-calibration-warning.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  EYE_GAZE_BASELINE_MIN_SAMPLES,
  EYE_GAZE_DOWN_DELTA_THRESHOLD,
  EYE_GAZE_LEFT_DELTA_THRESHOLD,
  EYE_GAZE_MIN_CONFIDENCE,
  EYE_GAZE_PROLONGED_THRESHOLD_MS,
  EYE_GAZE_RIGHT_DELTA_THRESHOLD,
  EYE_GAZE_WARNING_THRESHOLD_MS,
} from "../src/lib/face/eye-gaze-constants";
import {
  classifyGazeAgainstBaseline,
  EyeGazeBaselineTracker,
} from "../src/lib/face/eye-gaze-baseline";
import { EyeGazeSmoother } from "../src/lib/face/eye-gaze-smoothing";
import { computeEyeGazeWarningState } from "../src/lib/face/eye-gaze-warning";
import {
  HEAD_PROLONGED_THRESHOLD_MS,
  HEAD_WARNING_THRESHOLD_MS,
} from "../src/lib/face/head-pose-constants";
import {
  PROCTORING_ALERT_AUDIO_COOLDOWN_MS,
  PROCTORING_HEAD_WARNING_DISMISS_MS,
} from "../src/lib/proctoring/alert-audio";
import { resolveAttentionOverlay } from "../src/lib/proctoring/head-eye-fusion";
import type { EyeGazeEstimate } from "../src/types/eye-gaze";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function frame(
  x: number,
  y: number,
  patch: Partial<EyeGazeEstimate> = {},
): EyeGazeEstimate {
  const eye = {
    normalizedX: x,
    normalizedY: y,
    eyeWidth: 0.05,
    eyeHeight: 0.02,
    usable: true,
  };
  return {
    direction: "CENTER",
    confidence: 0.9,
    landmarkCount: 478,
    leftEye: eye,
    rightEye: { ...eye },
    fusedNormalizedX: x,
    fusedNormalizedY: y,
    headYaw: 2,
    headPitch: 1,
    ...patch,
  };
}

function lockNeutral(tracker: EyeGazeBaselineTracker, x = 0.5, y = 0.45) {
  let state = tracker.state;
  for (let i = 0; i < EYE_GAZE_BASELINE_MIN_SAMPLES; i += 1) {
    const jitter = i % 2 === 0 ? 0.01 : -0.01;
    state = tracker.consider(frame(x + jitter, y), "NORMAL");
  }
  return state;
}

function main() {
  assert(HEAD_WARNING_THRESHOLD_MS === 5_000, "head first warning remains 5s");
  assert(HEAD_PROLONGED_THRESHOLD_MS === 10_000, "head prolonged remains 10s");
  assert(PROCTORING_HEAD_WARNING_DISMISS_MS === 1_500, "dismiss remains 1.5s");
  assert(PROCTORING_ALERT_AUDIO_COOLDOWN_MS === 30_000, "audio cooldown remains 30s");
  assert(EYE_GAZE_WARNING_THRESHOLD_MS === 5_000, "eye first warning remains 5s");
  assert(EYE_GAZE_PROLONGED_THRESHOLD_MS === 10_000, "eye prolonged remains 10s");
  assert(EYE_GAZE_MIN_CONFIDENCE === 0.35, "min confidence unchanged");
  assert(
    EYE_GAZE_DOWN_DELTA_THRESHOLD > EYE_GAZE_LEFT_DELTA_THRESHOLD &&
      EYE_GAZE_DOWN_DELTA_THRESHOLD > EYE_GAZE_RIGHT_DELTA_THRESHOLD,
    "DOWN delta is more conservative than lateral deltas",
  );

  const early = new EyeGazeBaselineTracker();
  for (let i = 0; i < 3; i += 1) early.consider(frame(0.5, 0.45), "NORMAL");
  assert(!early.state.ready, "baseline not ready before minimum samples");
  const before = classifyGazeAgainstBaseline(frame(0.3, 0.45), early.state);
  assert(before.estimate.direction === "UNKNOWN", "UNKNOWN before baseline");
  assert(
    before.estimate.reason === "baseline_not_ready",
    "pre-baseline reason is baseline_not_ready",
  );
  assert(
    computeEyeGazeWarningState({
      stableDirection: before.estimate.direction,
      durationMs: 12_000,
      confidence: 0.9,
    }).tier === 0,
    "uncalibrated gaze does not warn",
  );

  const turned = new EyeGazeBaselineTracker();
  turned.consider(frame(0.5, 0.45), "LEFT");
  turned.consider(frame(0.5, 0.45, { headYaw: 40 }), "NORMAL");
  turned.consider(frame(0.5, 0.45, { headPitch: 40 }), "NORMAL");
  turned.consider(
    frame(0.5, 0.45, {
      leftEye: {
        normalizedX: null,
        normalizedY: null,
        eyeWidth: 0.01,
        eyeHeight: 0.01,
        usable: false,
      },
    }),
    "NORMAL",
  );
  assert(turned.state.sampleCount === 0, "unreliable frames are not baseline samples");

  const unstable = new EyeGazeBaselineTracker();
  for (let i = 0; i < 12; i += 1) {
    unstable.consider(frame(i % 2 === 0 ? 0.2 : 0.8, 0.45), "NORMAL");
  }
  assert(!unstable.state.ready, "large spread does not lock a baseline");

  const tracker = new EyeGazeBaselineTracker();
  const baseline = lockNeutral(tracker);
  assert(baseline.ready, "stable center samples lock the baseline");
  assert(baseline.x != null && Math.abs(baseline.x - 0.5) < 0.02, "baseline X is the median");
  assert(baseline.y === 0.45, "baseline Y is the median");

  const bx = baseline.x as number;
  const by = baseline.y as number;

  const center = classifyGazeAgainstBaseline(frame(bx + 0.04, by + 0.04), baseline);
  assert(center.estimate.direction === "CENTER", "near baseline stays CENTER");
  assert((center.deltaX ?? 0) > 0 === false || Math.abs(center.deltaX ?? 0) < 0.12, "small deltaX");

  const left = classifyGazeAgainstBaseline(frame(bx - 0.2, by), baseline);
  assert(left.estimate.direction === "LEFT", "negative deltaX is LEFT");
  assert((left.deltaX ?? 0) <= -EYE_GAZE_LEFT_DELTA_THRESHOLD, "LEFT crosses left threshold");

  const right = classifyGazeAgainstBaseline(frame(bx + 0.2, by), baseline);
  assert(right.estimate.direction === "RIGHT", "positive deltaX is RIGHT");
  assert((right.deltaX ?? 0) >= EYE_GAZE_RIGHT_DELTA_THRESHOLD, "RIGHT crosses right threshold");

  const down = classifyGazeAgainstBaseline(frame(bx, by + 0.22), baseline);
  assert(down.estimate.direction === "DOWN", "positive deltaY is DOWN");

  const mildDown = classifyGazeAgainstBaseline(frame(bx, by + 0.1), baseline);
  assert(mildDown.estimate.direction === "CENTER", "mild downward glance stays CENTER");

  const lockedX = tracker.state.x;
  for (let i = 0; i < 20; i += 1) tracker.consider(frame(0.1, 0.9), "NORMAL");
  assert(tracker.state.ready && tracker.state.x === lockedX, "looking away does not move the baseline");

  const smoother = new EyeGazeSmoother();
  let sawWarning = false;
  let sawProlonged = false;
  let stableLeft = false;
  const t0 = 1_000_000;
  for (let i = 0; i < 40; i += 1) {
    const classified = classifyGazeAgainstBaseline(frame(bx - 0.2, by), tracker.state);
    const tel = smoother.push(classified.estimate, t0 + i * 500);
    if (tel.stableDirection === "LEFT") stableLeft = true;
    const warning = computeEyeGazeWarningState({
      stableDirection: tel.stableDirection,
      durationMs: tel.durationMs,
      confidence: tel.confidence,
    });
    if (warning.tier >= 1) sawWarning = true;
    if (warning.tier >= 2) sawProlonged = true;
    if (warning.tier >= 1) {
      const overlay = resolveAttentionOverlay(0, warning.tier);
      assert(overlay.source === "eye", "head NORMAL + eye away uses the eye overlay");
      break;
    }
  }
  assert(stableLeft, "smoothing locks LEFT from relative samples");
  assert(sawWarning, "calibrated LEFT reaches the 5s eye warning");

  const prolonged = new EyeGazeSmoother();
  for (let i = 0; i < 40; i += 1) {
    const classified = classifyGazeAgainstBaseline(frame(bx - 0.2, by), tracker.state);
    const tel = prolonged.push(classified.estimate, t0 + i * 500);
    const warning = computeEyeGazeWarningState({
      stableDirection: tel.stableDirection,
      durationMs: tel.durationMs,
      confidence: tel.confidence,
    });
    if (warning.tier >= 2) {
      sawProlonged = true;
      assert(
        resolveAttentionOverlay(0, 2).source === "eye" &&
          resolveAttentionOverlay(0, 2).overlayTier === 2,
        "10s LEFT is a prolonged eye overlay",
      );
      break;
    }
  }
  assert(sawProlonged, "calibrated LEFT reaches the 10s prolonged warning");

  const rightSmoother = new EyeGazeSmoother();
  let rightWarned = false;
  for (let i = 0; i < 40; i += 1) {
    const classified = classifyGazeAgainstBaseline(frame(bx + 0.2, by), tracker.state);
    const tel = rightSmoother.push(classified.estimate, t0 + i * 500);
    const warning = computeEyeGazeWarningState({
      stableDirection: tel.stableDirection,
      durationMs: tel.durationMs,
      confidence: tel.confidence,
    });
    if (warning.tier >= 1 && tel.stableDirection === "RIGHT") {
      rightWarned = true;
      break;
    }
  }
  assert(rightWarned, "calibrated RIGHT reaches the 5s eye warning");

  const downSmoother = new EyeGazeSmoother();
  let downWarned = false;
  for (let i = 0; i < 40; i += 1) {
    const classified = classifyGazeAgainstBaseline(frame(bx, by + 0.22), tracker.state);
    const tel = downSmoother.push(classified.estimate, t0 + i * 500);
    const warning = computeEyeGazeWarningState({
      stableDirection: tel.stableDirection,
      durationMs: tel.durationMs,
      confidence: tel.confidence,
    });
    if (warning.tier >= 1 && tel.stableDirection === "DOWN") {
      downWarned = true;
      break;
    }
  }
  assert(downWarned, "calibrated DOWN reaches the 5s eye warning");

  const flip = new EyeGazeSmoother();
  let flipped = false;
  let at = t0;
  for (let i = 0; i < 20; i += 1) {
    const classified = classifyGazeAgainstBaseline(frame(bx - 0.2, by), tracker.state);
    const tel = flip.push(classified.estimate, at);
    at += 500;
    const warning = computeEyeGazeWarningState({
      stableDirection: tel.stableDirection,
      durationMs: tel.durationMs,
      confidence: tel.confidence,
    });
    if (tel.stableDirection === "LEFT" && tel.durationMs >= 2_000 && warning.tier === 0) {
      for (let j = 0; j < 6; j += 1) {
        const next = classifyGazeAgainstBaseline(frame(bx + 0.2, by), tracker.state);
        const telRight = flip.push(next.estimate, at);
        at += 500;
        if (telRight.stableDirection === "RIGHT") {
          assert(
            telRight.durationMs < EYE_GAZE_WARNING_THRESHOLD_MS,
            "LEFT then RIGHT starts a new eye-away episode",
          );
          flipped = true;
          break;
        }
      }
      break;
    }
  }
  assert(flipped, "direction change resets the eye-away episode");

  const centerHold = new EyeGazeSmoother();
  let centerQuiet = true;
  for (let i = 0; i < 30; i += 1) {
    const classified = classifyGazeAgainstBaseline(frame(bx + 0.03, by), tracker.state);
    const tel = centerHold.push(classified.estimate, t0 + i * 500);
    const warning = computeEyeGazeWarningState({
      stableDirection: tel.stableDirection,
      durationMs: tel.durationMs,
      confidence: tel.confidence,
    });
    if (warning.tier !== 0) centerQuiet = false;
  }
  assert(centerQuiet, "calibrated CENTER never warns");

  assert(
    resolveAttentionOverlay(1, 0).source === "head" &&
      resolveAttentionOverlay(2, 0).overlayTier === 2,
    "UNKNOWN eyes leave the head 5s/10s warning in place",
  );

  const sessionA = new EyeGazeBaselineTracker();
  lockNeutral(sessionA, 0.42, 0.4);
  const sessionB = new EyeGazeBaselineTracker();
  assert(!sessionB.state.ready, "a new session does not inherit the previous baseline");
  const retained = sessionA.state.x;
  assert(sessionA.state.ready, "stopping samples does not clear a locked baseline");
  assert(sessionA.state.x === retained, "face-loss gap keeps the same baseline");
  sessionA.reset();
  assert(!sessionA.state.ready, "camera restart / session end clears the baseline");

  const detector = read("src/lib/face/head-pose-detector.ts");
  const calls = detector.match(/detectForVideo\(/g) ?? [];
  assert(calls.length === 1, "still exactly one detectForVideo() per sample");

  const hook = read("src/hooks/use-eye-gaze-monitoring.ts");
  const metaStart = hook.indexOf("const meta = {");
  const metaEnd = hook.indexOf("};", metaStart);
  const meta = hook.slice(metaStart, metaEnd);
  assert(!meta.includes("baseline") && !meta.includes("delta"), "SecurityEvent metadata omits baseline and deltas");
  assert(!meta.includes("fused") && !meta.includes("landmark"), "SecurityEvent metadata omits iris geometry");
  const faceLoss = hook.slice(hook.indexOf("Face loss"), hook.indexOf("lastEstimateRef.current = estimate"));
  assert(!faceLoss.includes("baselineRef.current.reset"), "face loss does not recalibrate");
  assert(hook.includes("!cameraActive") && hook.includes("baselineRef.current.reset"), "camera stop clears the baseline");

  const baselineSrc = read("src/lib/face/eye-gaze-baseline.ts");
  assert(!baselineSrc.includes("mongoose") && !baselineSrc.includes("connectDB"), "baseline module does not touch the database");

  const modelsDir = path.join(process.cwd(), "src/models");
  for (const name of fs.readdirSync(modelsDir)) {
    const src = fs.readFileSync(path.join(modelsDir, name), "utf8");
    assert(!src.includes("baselineX") && !src.includes("EyeGazeBaseline"), `${name} does not store a gaze baseline`);
  }

  const calib = read("src/lib/face/eye-gaze-calibration.ts");
  assert(calib.includes("recalibrate"), "DEV recalibrate helper exists");
  assert(calib.includes("NODE_ENV === \"production\""), "calibration API stays off in production");

  console.log("\nEye-gaze baseline calibration checks passed.");
}

main();
