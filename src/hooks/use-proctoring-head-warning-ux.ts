"use client";

import { useEffect, useRef, useState } from "react";
import type { HeadMonitoringStatus } from "@/hooks/use-head-pose-monitoring";
import type { HeadOrientation } from "@/lib/face/head-pose-orientation";
import {
  PROCTORING_HEAD_WARNING_DISMISS_MS,
  playProctoringAlertTone,
} from "@/lib/proctoring/alert-audio";

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

/**
 * Presentation layer for sustained head-looking-away warnings.
 * Consumes existing Phase 8B detection signals — does not run vision itself.
 */
export function useProctoringHeadWarningUx({
  enabled,
  headStatus,
  headOrientation,
  headWarning,
  warningTier,
  blockedByHigherPriority,
}: Options) {
  const [visible, setVisible] = useState(false);
  const [level, setLevel] = useState<ProctoringHeadWarningLevel>(1);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevWarningRef = useRef("");

  const lookingAway =
    Boolean(headWarning) || headStatus === "looking_away";

  useEffect(() => {
    if (!enabled || blockedByHigherPriority) {
      setVisible(false);
      return;
    }

    if (lookingAway) {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setVisible(true);
      setLevel(warningTier >= 2 ? 2 : 1);
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
    lookingAway,
    visible,
    warningTier,
  ]);

  useEffect(() => {
    if (!enabled || blockedByHigherPriority) return;

    const isNewWarning = Boolean(headWarning) && !prevWarningRef.current;
    if (isNewWarning) {
      const audioPlayed = playProctoringAlertTone();
      if (process.env.NODE_ENV === "development") {
        console.log("[Proctoring Warning]", {
          type: "LOOKING_AWAY",
          direction: headOrientation,
          warningShown: true,
          audioPlayed,
        });
      }
    }
    prevWarningRef.current = headWarning;
  }, [blockedByHigherPriority, enabled, headOrientation, headWarning]);

  useEffect(() => {
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const title =
    level >= 2
      ? "Please return your focus to the exam screen."
      : "Please look at the screen.";

  const body =
    level >= 2
      ? "Continued head movement may be recorded as a proctoring event."
      : directionDetail(headOrientation) ??
        "Your head appears to be turned away from the exam screen.";

  const support =
    level >= 2
      ? "Please return your focus to the screen to continue."
      : "Please return your focus to the screen to continue.";

  return {
    visible,
    level,
    title,
    body,
    support,
  };
}
