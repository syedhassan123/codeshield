"use client";

import {
  EYE_GAZE_DOWN_DELTA_THRESHOLD,
  EYE_GAZE_DOWN_THRESHOLD,
  EYE_GAZE_EXPECTED_LANDMARK_COUNT,
  EYE_GAZE_HORIZONTAL_CENTER_MAX,
  EYE_GAZE_HORIZONTAL_CENTER_MIN,
  EYE_GAZE_LEFT_DELTA_THRESHOLD,
  EYE_GAZE_MIN_CONFIDENCE,
  EYE_GAZE_PROLONGED_THRESHOLD_MS,
  EYE_GAZE_RIGHT_DELTA_THRESHOLD,
  EYE_GAZE_SMOOTH_MIN_AGREEMENT,
  EYE_GAZE_SMOOTH_WINDOW,
  EYE_GAZE_WARNING_THRESHOLD_MS,
} from "@/lib/face/eye-gaze-constants";
import { fuseHeadEyeAttention } from "@/lib/proctoring/head-eye-fusion";
import type { EyeGazeTelemetry } from "@/types/eye-gaze";

type Props = {
  telemetry: EyeGazeTelemetry;
  warningTier?: 0 | 1 | 2;
  warningDurationMs?: number;
  eyeAway?: boolean;
  headWarningTier?: 0 | 1 | 2;
  headOrientation?: string;
  headStatus?: string;
  /** Live overlay flag from the shared warning UX hook. */
  overlayVisible?: boolean;
};

/**
 * Development-only eye-gaze telemetry panel for Phase D calibration.
 * Never shown in production builds.
 */
export function EyeGazeDebugPanel({
  telemetry,
  warningTier = 0,
  warningDurationMs = 0,
  eyeAway = false,
  headWarningTier = 0,
  headOrientation = "NORMAL",
  headStatus = "active",
  overlayVisible = false,
}: Props) {
  if (process.env.NODE_ENV === "production") return null;

  const fmt = (n: number | null | undefined, digits = 3) =>
    n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits);

  const confPct = Math.round(Math.min(1, Math.max(0, telemetry.confidence)) * 100);
  const landmarkOk =
    telemetry.landmarkCount === EYE_GAZE_EXPECTED_LANDMARK_COUNT;
  const fusion = fuseHeadEyeAttention({
    headStatus,
    headOrientation,
    headWarning: headWarningTier >= 1,
    headWarningTier,
    stableEyeDirection: telemetry.stableDirection,
    eyeAway,
    eyeWarningTier: warningTier,
    eyeConfidence: telemetry.confidence,
  });

  return (
    <div
      className="fixed bottom-3 left-3 z-[60] max-w-sm rounded-lg border border-border bg-background/95 p-3 text-[10px] shadow-elevated font-mono"
      data-eye-gaze-debug="true"
      aria-label="Eye gaze debug telemetry"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
        Eye gaze (dev calibration)
      </p>
      <p className="mb-1.5 text-[10px] font-semibold">
        {telemetry.calibrationStatus ?? "Tracking unavailable"}
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-muted-foreground">baselineReady</dt>
        <dd>{telemetry.baselineReady ? "yes" : "no"}</dd>
        <dt className="text-muted-foreground">baselineSamples</dt>
        <dd>{telemetry.baselineSampleCount ?? 0}</dd>
        <dt className="text-muted-foreground">baselineX</dt>
        <dd>{fmt(telemetry.baselineX)}</dd>
        <dt className="text-muted-foreground">baselineY</dt>
        <dd>{fmt(telemetry.baselineY)}</dd>
        <dt className="text-muted-foreground">spreadX/Y</dt>
        <dd>
          {fmt(telemetry.baselineSpreadX)} / {fmt(telemetry.baselineSpreadY)}
        </dd>
        <dt className="text-muted-foreground">fusedX</dt>
        <dd>{fmt(telemetry.fusedNormalizedX)}</dd>
        <dt className="text-muted-foreground">fusedY</dt>
        <dd>{fmt(telemetry.fusedNormalizedY)}</dd>
        <dt className="text-muted-foreground">deltaX</dt>
        <dd>{fmt(telemetry.deltaX)}</dd>
        <dt className="text-muted-foreground">deltaY</dt>
        <dd>{fmt(telemetry.deltaY)}</dd>
        <dt className="text-muted-foreground">rawDirection</dt>
        <dd>{telemetry.rawDirection}</dd>
        <dt className="text-muted-foreground">stableDirection</dt>
        <dd className="font-semibold">{telemetry.stableDirection}</dd>
        <dt className="text-muted-foreground">absolute</dt>
        <dd>{telemetry.absoluteDirection ?? "—"}</dd>
        <dt className="text-muted-foreground">confidence</dt>
        <dd>
          {fmt(telemetry.confidence, 2)}
          <span className="ml-2 inline-block h-1.5 w-16 align-middle rounded bg-muted overflow-hidden">
            <span
              className="block h-full bg-primary"
              style={{ width: `${confPct}%` }}
            />
          </span>
        </dd>
        <dt className="text-muted-foreground">durationMs</dt>
        <dd>{telemetry.durationMs}</dd>
        <dt className="text-muted-foreground">eyeWarnMs</dt>
        <dd>{warningDurationMs}</dd>
        <dt className="text-muted-foreground">eyeTier</dt>
        <dd>{warningTier}</dd>
        <dt className="text-muted-foreground">fusion</dt>
        <dd className="truncate">{fusion.combinedAttentionState}</dd>
        <dt className="text-muted-foreground">fusionSource</dt>
        <dd>
          {fusion.warningSource}/{fusion.warningTier}
        </dd>
        <dt className="text-muted-foreground">overlayVisible</dt>
        <dd>{overlayVisible ? "true" : "false"}</dd>
        <dt className="text-muted-foreground">landmarkCount</dt>
        <dd className={landmarkOk ? "text-success" : "text-danger"}>
          {telemetry.landmarkCount || "—"}
          {telemetry.landmarkCount
            ? ` / ${EYE_GAZE_EXPECTED_LANDMARK_COUNT}`
            : ""}
        </dd>
        <dt className="text-muted-foreground">yaw</dt>
        <dd>
          {telemetry.headYaw == null ? "—" : Math.round(telemetry.headYaw)}
        </dd>
        <dt className="text-muted-foreground">pitch</dt>
        <dd>
          {telemetry.headPitch == null ? "—" : Math.round(telemetry.headPitch)}
        </dd>
        {telemetry.reason ? (
          <>
            <dt className="text-muted-foreground">reason</dt>
            <dd className="truncate">{telemetry.reason}</dd>
          </>
        ) : null}
      </dl>
      <p className="mt-2 pt-2 border-t border-border text-[9px] text-muted-foreground leading-relaxed">
        Δ LEFT ≤ -{EYE_GAZE_LEFT_DELTA_THRESHOLD.toFixed(2)} · RIGHT ≥{" "}
        {EYE_GAZE_RIGHT_DELTA_THRESHOLD.toFixed(2)} · DOWN ≥{" "}
        {EYE_GAZE_DOWN_DELTA_THRESHOLD.toFixed(2)} · absolute CENTER{" "}
        {EYE_GAZE_HORIZONTAL_CENTER_MIN.toFixed(2)}–
        {EYE_GAZE_HORIZONTAL_CENTER_MAX.toFixed(2)} · abs DOWN ≥{" "}
        {EYE_GAZE_DOWN_THRESHOLD.toFixed(2)} · minConf{" "}
        {EYE_GAZE_MIN_CONFIDENCE.toFixed(2)} · smooth{" "}
        {EYE_GAZE_SMOOTH_WINDOW}/{EYE_GAZE_SMOOTH_MIN_AGREEMENT} · warn{" "}
        {EYE_GAZE_WARNING_THRESHOLD_MS / 1000}s/
        {EYE_GAZE_PROLONGED_THRESHOLD_MS / 1000}s
      </p>
      <p className="mt-1 text-[9px] text-muted-foreground">
        window.__codeshieldEyeGaze.summary() · recalibrate()
      </p>
    </div>
  );
}
