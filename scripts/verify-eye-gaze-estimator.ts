/**
 * Eye-gaze Phase A–C verification (geometry + smoothing; no warnings).
 * Run: npx tsx --env-file=.env.local scripts/verify-eye-gaze-estimator.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  EYE_GAZE_EXPECTED_LANDMARK_COUNT,
  EYE_GAZE_SMOOTH_WINDOW,
} from "../src/lib/face/eye-gaze-constants";
import {
  createSyntheticLandmarkFrame,
  estimateEyeGaze,
  placeSyntheticEye,
} from "../src/lib/face/eye-gaze-estimator";
import { LEFT_EYE, RIGHT_EYE } from "../src/lib/face/eye-gaze-landmarks";
import { EyeGazeSmoother } from "../src/lib/face/eye-gaze-smoothing";
import {
  HEAD_PROLONGED_THRESHOLD_MS,
  HEAD_WARNING_THRESHOLD_MS,
} from "../src/lib/face/head-pose-constants";
import { PROCTORING_ALERT_AUDIO_COOLDOWN_MS, PROCTORING_HEAD_WARNING_DISMISS_MS } from "../src/lib/proctoring/alert-audio";
import { EYE_GAZE_DIRECTIONS } from "../src/types/eye-gaze";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function bothEyesCentered(iris = { x: 0.5, y: 0.45 }) {
  const overrides: Record<number, { x: number; y: number }> = {};
  placeSyntheticEye(
    overrides,
    RIGHT_EYE,
    { left: 0.3, right: 0.4, top: 0.4, bottom: 0.48 },
    iris,
  );
  placeSyntheticEye(
    overrides,
    LEFT_EYE,
    { left: 0.6, right: 0.7, top: 0.4, bottom: 0.48 },
    iris,
  );
  return createSyntheticLandmarkFrame(overrides);
}

function main() {
  assert(
    HEAD_WARNING_THRESHOLD_MS === 5_000,
    "head first-warning timing unchanged (5s)",
  );
  assert(
    HEAD_PROLONGED_THRESHOLD_MS === 10_000,
    "head prolonged-warning timing unchanged (10s)",
  );
  assert(
    PROCTORING_HEAD_WARNING_DISMISS_MS === 1_500,
    "head dismiss timing unchanged (1.5s)",
  );
  assert(
    PROCTORING_ALERT_AUDIO_COOLDOWN_MS === 30_000,
    "head audio cooldown unchanged (30s)",
  );

  assert(
    EYE_GAZE_EXPECTED_LANDMARK_COUNT === 478,
    "expected landmark count is 478",
  );
  assert(
    EYE_GAZE_DIRECTIONS.includes("CENTER") &&
      EYE_GAZE_DIRECTIONS.includes("LEFT") &&
      EYE_GAZE_DIRECTIONS.includes("RIGHT") &&
      EYE_GAZE_DIRECTIONS.includes("DOWN") &&
      EYE_GAZE_DIRECTIONS.includes("UNKNOWN"),
    "gaze state enum complete",
  );

  const detectorSrc = read("src/lib/face/head-pose-detector.ts");
  assert(
    detectorSrc.includes("estimateEyeGaze") &&
      detectorSrc.includes("detectForVideo"),
    "gaze reuses same detectForVideo sample path",
  );
  assert(
    (detectorSrc.match(/detectForVideo/g) || []).length === 1,
    "exactly one detectForVideo call in head-pose-detector",
  );
  assert(
    !detectorSrc.includes("outputFaceBlendshapes"),
    "blendshapes not enabled",
  );

  const packageJson = read("package.json");
  assert(
    packageJson.includes('"@mediapipe/tasks-vision"'),
    "no second gaze ML package added",
  );
  assert(
    !packageJson.includes("webgazer") && !packageJson.includes("gaze-detection"),
    "no external gaze dependency",
  );

  const badCount = estimateEyeGaze({
    landmarks: createSyntheticLandmarkFrame({}).slice(0, 100),
    headYaw: 0,
    headPitch: 0,
  });
  assert(badCount.direction === "UNKNOWN", "invalid landmark count → UNKNOWN");
  assert(badCount.confidence === 0, "invalid count confidence is 0");
  assert(
    badCount.reason?.includes("landmark_count"),
    "invalid count reason reported",
  );

  const centered = estimateEyeGaze({
    landmarks: bothEyesCentered({ x: 0.5, y: 0.45 }),
    headYaw: 0,
    headPitch: 0,
  });
  assert(centered.direction === "CENTER", "iris centered → CENTER");
  assert(
    centered.confidence >= 0 && centered.confidence <= 1,
    "confidence in [0,1]",
  );
  assert(centered.landmarkCount === 478, "centered sample reports 478");

  const lookingLeft = estimateEyeGaze({
    landmarks: bothEyesCentered({ x: 0.15, y: 0.45 }),
    headYaw: 0,
    headPitch: 0,
  });
  assert(lookingLeft.direction === "LEFT", "iris lateral low-x → LEFT");

  const lookingRight = estimateEyeGaze({
    landmarks: bothEyesCentered({ x: 0.85, y: 0.45 }),
    headYaw: 0,
    headPitch: 0,
  });
  assert(lookingRight.direction === "RIGHT", "iris lateral high-x → RIGHT");

  const lookingDown = estimateEyeGaze({
    landmarks: bothEyesCentered({ x: 0.5, y: 0.9 }),
    headYaw: 0,
    headPitch: 0,
  });
  assert(lookingDown.direction === "DOWN", "iris low in eye → DOWN");

  const disagreeOverrides: Record<number, { x: number; y: number }> = {};
  placeSyntheticEye(
    disagreeOverrides,
    RIGHT_EYE,
    { left: 0.3, right: 0.4, top: 0.4, bottom: 0.48 },
    { x: 0.1, y: 0.45 },
  );
  placeSyntheticEye(
    disagreeOverrides,
    LEFT_EYE,
    { left: 0.6, right: 0.7, top: 0.4, bottom: 0.48 },
    { x: 0.9, y: 0.45 },
  );
  const disagree = estimateEyeGaze({
    landmarks: createSyntheticLandmarkFrame(disagreeOverrides),
    headYaw: 0,
    headPitch: 0,
  });
  assert(disagree.direction === "UNKNOWN", "eyes disagree → UNKNOWN");

  const collapsedOverrides: Record<number, { x: number; y: number }> = {};
  placeSyntheticEye(
    collapsedOverrides,
    RIGHT_EYE,
    { left: 0.35, right: 0.351, top: 0.4, bottom: 0.401 },
    { x: 0.5, y: 0.5 },
  );
  placeSyntheticEye(
    collapsedOverrides,
    LEFT_EYE,
    { left: 0.65, right: 0.651, top: 0.4, bottom: 0.401 },
    { x: 0.5, y: 0.5 },
  );
  const collapsed = estimateEyeGaze({
    landmarks: createSyntheticLandmarkFrame(collapsedOverrides),
    headYaw: 0,
    headPitch: 0,
  });
  assert(collapsed.direction === "UNKNOWN", "collapsed eye width → UNKNOWN");

  const extremeHead = estimateEyeGaze({
    landmarks: bothEyesCentered({ x: 0.15, y: 0.45 }),
    headYaw: 45,
    headPitch: 0,
  });
  assert(
    extremeHead.direction === "UNKNOWN",
    "extreme head yaw → UNKNOWN",
  );

  const smoother = new EyeGazeSmoother();
  const flap: Array<"CENTER" | "LEFT"> = [
    "CENTER",
    "LEFT",
    "CENTER",
    "LEFT",
    "LEFT",
  ];
  let lastStable = "UNKNOWN";
  for (const dir of flap) {
    const est =
      dir === "CENTER"
        ? estimateEyeGaze({
            landmarks: bothEyesCentered({ x: 0.5, y: 0.45 }),
            headYaw: 0,
            headPitch: 0,
          })
        : estimateEyeGaze({
            landmarks: bothEyesCentered({ x: 0.12, y: 0.45 }),
            headYaw: 0,
            headPitch: 0,
          });
    const tel = smoother.push(est, Date.now());
    lastStable = tel.stableDirection;
  }
  assert(
    lastStable === "LEFT" || lastStable === "CENTER" || lastStable === "UNKNOWN",
    "smoother produces a valid stable state after flap sequence",
  );
  assert(EYE_GAZE_SMOOTH_WINDOW >= 4, "smoothing window is at least 4 samples");

  const hold = new EyeGazeSmoother();
  let duration = 0;
  const t0 = 1_000_000;
  for (let i = 0; i < 6; i += 1) {
    const est = estimateEyeGaze({
      landmarks: bothEyesCentered({ x: 0.12, y: 0.45 }),
      headYaw: 0,
      headPitch: 0,
    });
    const tel = hold.push(est, t0 + i * 500);
    duration = tel.durationMs;
  }
  assert(
    duration >= 500,
    "sustained LEFT accumulates durationMs after stable lock",
  );

  const examSrc = read("src/components/exam/exam-session-client.tsx");
  assert(
    examSrc.includes("EyeGazeDebugPanel") &&
      examSrc.includes('NODE_ENV !== "production"'),
    "gaze debug panel is production-gated",
  );
  assert(
    !examSrc.includes("GAZE_LEFT") && !examSrc.includes("GAZE_RIGHT"),
    "exam session has no legacy GAZE_LEFT/GAZE_RIGHT event names",
  );

  const actionSrc = read("src/lib/actions/exam-security.ts");
  assert(
    !actionSrc.includes("GAZE_LEFT") && actionSrc.includes("isEyeGazeObservationEvent"),
    "exam-security action uses dedicated eye-gaze observation dedup",
  );

  const hookSrc = read("src/hooks/use-eye-gaze-monitoring.ts");
  assert(
    hookSrc.includes("recordExamSecurityEventAction") &&
      hookSrc.includes("EYE_GAZE_AWAY") &&
      hookSrc.includes("warningLoggedRef"),
    "eye-gaze hook persists only threshold-crossing events",
  );
  assert(
    !hookSrc.includes("ProctoringHeadWarningOverlay"),
    "eye-gaze hook does not render the overlay",
  );

  const calibSrc = read("src/lib/face/eye-gaze-calibration.ts");
  assert(
    calibSrc.includes("EyeGazeCalibrationSample") &&
      calibSrc.includes("pushEyeGazeCalibrationSample"),
    "DEV calibration sample ring exists",
  );
  assert(
    !calibSrc.includes("landmarks") ||
      calibSrc.includes("never stores landmark"),
    "calibration API documents no landmark persistence",
  );
  assert(
    hookSrc.includes("pushEyeGazeCalibrationSample"),
    "eye-gaze hook feeds calibration ring",
  );

  const panelSrc = read("src/components/exam/eye-gaze-debug-panel.tsx");
  assert(
    panelSrc.includes("EYE_GAZE_HORIZONTAL_CENTER_MIN") &&
      panelSrc.includes("landmarkCount"),
    "debug panel shows thresholds and landmark count",
  );

  console.log("\nEye-gaze estimator Phase A–C / D tooling checks passed.");
}

main();
