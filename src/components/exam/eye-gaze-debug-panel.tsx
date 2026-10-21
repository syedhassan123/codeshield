"use client";

import {
  EYE_GAZE_DOWN_THRESHOLD,
  EYE_GAZE_EXPECTED_LANDMARK_COUNT,
  EYE_GAZE_HORIZONTAL_CENTER_MAX,
  EYE_GAZE_HORIZONTAL_CENTER_MIN,
  EYE_GAZE_MIN_CONFIDENCE,
  EYE_GAZE_SMOOTH_MIN_AGREEMENT,
  EYE_GAZE_SMOOTH_WINDOW,
} from "@/lib/face/eye-gaze-constants";
import type { EyeGazeTelemetry } from "@/types/eye-gaze";

type Props = {
  telemetry: EyeGazeTelemetry;
};

/**
 * Development-only eye-gaze telemetry panel for Phase D calibration.
 * Never shown in production builds.
 */
export function EyeGazeDebugPanel({ telemetry }: Props) {
  if (process.env.NODE_ENV === "production") return null;

  const fmt = (n: number | null | undefined, digits = 3) =>
    n == null || !Number.isFinite(n) ? "—" : n.toFixed(digits);

  const confPct = Math.round(Math.min(1, Math.max(0, telemetry.confidence)) * 100);
  const landmarkOk =
    telemetry.landmarkCount === EYE_GAZE_EXPECTED_LANDMARK_COUNT;

  return (
    <div
      className="fixed bottom-3 left-3 z-[60] max-w-sm rounded-lg border border-border bg-background/95 p-3 text-[10px] shadow-elevated font-mono"
      data-eye-gaze-debug="true"
      aria-label="Eye gaze debug telemetry"
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
        Eye gaze (dev calibration)
      </p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
        <dt className="text-muted-foreground">raw</dt>
        <dd>{telemetry.rawDirection}</dd>
        <dt className="text-muted-foreground">stable</dt>
        <dd className="font-semibold">{telemetry.stableDirection}</dd>
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
        <dt className="text-muted-foreground">landmarks</dt>
        <dd className={landmarkOk ? "text-success" : "text-danger"}>
          {telemetry.landmarkCount || "—"}
          {telemetry.landmarkCount
            ? ` / ${EYE_GAZE_EXPECTED_LANDMARK_COUNT}`
            : ""}
        </dd>
        <dt className="text-muted-foreground">leftX</dt>
        <dd>{fmt(telemetry.leftNormalizedX)}</dd>
        <dt className="text-muted-foreground">rightX</dt>
        <dd>{fmt(telemetry.rightNormalizedX)}</dd>
        <dt className="text-muted-foreground">fusedX</dt>
        <dd>{fmt(telemetry.fusedNormalizedX)}</dd>
        <dt className="text-muted-foreground">fusedY</dt>
        <dd>{fmt(telemetry.fusedNormalizedY)}</dd>
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
        CENTER {EYE_GAZE_HORIZONTAL_CENTER_MIN.toFixed(2)}–
        {EYE_GAZE_HORIZONTAL_CENTER_MAX.toFixed(2)} · DOWN ≥{" "}
        {EYE_GAZE_DOWN_THRESHOLD.toFixed(2)} · minConf{" "}
        {EYE_GAZE_MIN_CONFIDENCE.toFixed(2)} · smooth{" "}
        {EYE_GAZE_SMOOTH_WINDOW}/{EYE_GAZE_SMOOTH_MIN_AGREEMENT}
      </p>
      <p className="mt-1 text-[9px] text-muted-foreground">
        window.__codeshieldEyeGaze.summary()
      </p>
    </div>
  );
}
