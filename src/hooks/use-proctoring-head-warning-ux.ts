"use client";

import { useEffect, useRef, useState } from "react";
import type { HeadMonitoringStatus } from "@/hooks/use-head-pose-monitoring";
import type { EyeGazeAwayDirection } from "@/lib/face/eye-gaze-warning";
import type { HeadOrientation } from "@/lib/face/head-pose-orientation";
import {
  PROCTORING_HEAD_WARNING_DISMISS_MS,
  playProctoringAlertTone,
} from "@/lib/proctoring/alert-audio";
import {
  eyeDirectionLabel,
  resolveAttentionOverlay,
  type AttentionWarningSource,
} from "@/lib/proctoring/head-eye-fusion";

export type ProctoringHeadWarningLevel = 1 | 2;

type Options = {
  enabled: boolean;
  headStatus: HeadMonitoringStatus;
  headOrientation: HeadOrientation;
  /** Set by existing detector when sustained threshold is reached. */
  headWarning: string;
  /** 0 = none, 1 = initial threshold, 2 = prolonged threshold. */
  warningTier: 0 | 1 | 2;
  /** Suppress when a higher-priority security banner is active. */
  blockedByHigherPriority: boolean;
  /** Independent eye-gaze warning (additive; optional). */
  eyeWarning?: boolean;
  eyeWarningTier?: 0 | 1 | 2;
  eyeDirection?: EyeGazeAwayDirection | null;
};

function directionDetail(orientation: HeadOrientation): string | null {
  switch (orientation) {
    case "LEFT":
      return "Your head is turned to the left.";
    case "RIGHT":
      return "Your head is turned to the right.";
    case "UP":
    case "DOWN":
      return "Your head appears to be turned away from the exam screen.";
    default:
      return null;
  }
}

function copyForSource(
  source: AttentionWarningSource,
  level: ProctoringHeadWarningLevel,
  headOrientation: HeadOrientation,
  eyeDirection: EyeGazeAwayDirection | null | undefined,
): { title: string; body: string; support: string } {
  const support = "Please return your focus to the screen to continue.";

  if (source === "eye") {
    if (level >= 2) {
      return {
        title: "Please keep your attention on the assessment screen",
        body:
          "Continued looking away from the screen may be recorded as a proctoring event.",
        support,
      };
    }
    return {
      title: "Keep your eyes on the assessment screen",
      body:
        eyeDirectionLabel(eyeDirection ?? null) ??
        "Your gaze appears to have moved away from the assessment screen.",
      support,
    };
  }

  if (source === "combined") {
    return {
      title: "Please keep your attention on the assessment screen",
      body:
        "Your head and eyes both appear away from the assessment screen.",
      support,
    };
  }

  return {
    title:
      level >= 2
        ? "Please return your focus to the exam screen."
        : "Please look at the screen.",
    body:
      level >= 2
        ? "Continued head movement may be recorded as a proctoring event."
        : directionDetail(headOrientation) ??
          "Your head appears to be turned away from the exam screen.",
    support:
      level >= 2
        ? "Please return your focus to the screen to continue."
        : support,
  };
}

/**
 * Presentation layer for sustained head-looking-away warnings.
 * Consumes existing Phase 8B detection signals — does not run vision itself.
 * Visibility follows headWarning / warningTier (20s+), not raw looking_away status.
 * Eye-gaze overlay is additive via the same single overlay + dismiss timer.
 */
export function useProctoringHeadWarningUx({
  enabled,
  headOrientation,
  headWarning,
  warningTier,
  blockedByHigherPriority,
  eyeWarning = false,
  eyeWarningTier = 0,
  eyeDirection = null,
}: Options) {
  const [visible, setVisible] = useState(false);
  const [level, setLevel] = useState<ProctoringHeadWarningLevel>(1);
  const [source, setSource] = useState<AttentionWarningSource>("head");
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWarningRef = useRef("");
  const prevAnyRef = useRef(false);

  const overlay = resolveAttentionOverlay(warningTier, eyeWarningTier);
  const thresholdReached =
    Boolean(headWarning) ||
    warningTier >= 1 ||
    eyeWarning ||
    eyeWarningTier >= 1;

  useEffect(() => {
    if (!enabled || blockedByHigherPriority) {
      setVisible(false);
      return;
    }

    if (thresholdReached) {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setVisible(true);
      setLevel(overlay.overlayTier >= 2 ? 2 : 1);
      if (overlay.source !== "none") setSource(overlay.source);
      return;
    }

    if (visible && !dismissTimerRef.current) {
      dismissTimerRef.current = setTimeout(() => {
        setVisible(false);
        dismissTimerRef.current = null;
      }, PROCTORING_HEAD_WARNING_DISMISS_MS);
    }
  }, [
    blockedByHigherPriority,
    enabled,
    overlay.overlayTier,
    overlay.source,
    thresholdReached,
    visible,
  ]);

  useEffect(() => {
    if (!enabled || blockedByHigherPriority) return;

    const anyWarning = Boolean(headWarning) || eyeWarning || eyeWarningTier >= 1;
    const isNewHeadWarning = Boolean(headWarning) && !prevWarningRef.current;
    const isNewAny = anyWarning && !prevAnyRef.current;

    if (isNewAny) {
      const audioPlayed = playProctoringAlertTone();
      if (process.env.NODE_ENV === "development") {
        console.log("[Proctoring Warning]", {
          type: isNewHeadWarning ? "LOOKING_AWAY" : "EYE_GAZE",
          direction: isNewHeadWarning ? headOrientation : eyeDirection,
          warningShown: true,
          audioPlayed,
        });
      }
    }
    prevWarningRef.current = headWarning;
    prevAnyRef.current = anyWarning;
  }, [
    blockedByHigherPriority,
    enabled,
    eyeDirection,
    eyeWarning,
    eyeWarningTier,
    headOrientation,
    headWarning,
  ]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const copy = copyForSource(source, level, headOrientation, eyeDirection);

  return {
    visible,
    level,
    source,
    title: copy.title,
    body: copy.body,
    support: copy.support,
  };
}
