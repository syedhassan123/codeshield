"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";
import {
  SECURITY_CLIPBOARD_DEDUP_MS,
  SECURITY_LEAVE_DEDUP_MS,
} from "@/lib/exam/security";
import type { AssessmentSecuritySettings } from "@/types/assessment-security";
import { DEFAULT_ASSESSMENT_SECURITY } from "@/types/assessment-security";
import type { SecurityEventType } from "@/types/exam-security";

export type ExamSecurityWarning = {
  message: string;
  level: "first" | "repeat";
} | null;

type Options = {
  attemptId: string;
  /** When false, listeners are not attached (e.g. after submit). */
  enabled?: boolean;
  settings?: AssessmentSecuritySettings;
};

/**
 * Exam browser security layer.
 *
 * Limitations (by design — browsers cannot fully prevent these):
 * - Tab/window switching cannot be blocked; we DETECT + WARN + LOG only.
 * - Fullscreen must be requested from a user gesture; page-load requests fail.
 * - Clipboard prevention works for standard Ctrl/Cmd shortcuts and events;
 *   OS-level or browser extensions may still bypass.
 */
export function useExamSecurity({
  attemptId,
  enabled = true,
  settings = DEFAULT_ASSESSMENT_SECURITY,
}: Options) {
  const [warning, setWarning] = useState<ExamSecurityWarning>(null);
  const [violationCount, setViolationCount] = useState(0);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [fullscreenMessage, setFullscreenMessage] = useState("");

  const lastSentRef = useRef<Partial<Record<SecurityEventType, number>>>({});
  const lastLeaveAtRef = useRef(0);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const violationCountRef = useRef(0);
  const enabledRef = useRef(enabled);
  const attemptIdRef = useRef(attemptId);
  const settingsRef = useRef(settings);
  /** When true, fullscreenchange must not log FULLSCREEN_EXIT (intentional post-submit exit). */
  const suppressFullscreenExitRef = useRef(false);

  enabledRef.current = enabled;
  attemptIdRef.current = attemptId;
  settingsRef.current = settings;

  const showWarning = useCallback((kind: "leave" | "clipboard" | "fullscreen") => {
    const nextCount = violationCountRef.current;
    const message =
      kind === "fullscreen"
        ? "Please return to fullscreen mode. Leaving fullscreen has been recorded."
        : kind === "leave"
          ? "Warning: You left the exam window. This activity has been recorded."
          : nextCount >= 2
            ? "You have multiple exam security violations. Continued violations may be reviewed by an administrator."
            : "Warning: This activity has been recorded.";

    setWarning({
      message,
      level: nextCount >= 2 ? "repeat" : "first",
    });

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    warningTimerRef.current = setTimeout(() => setWarning(null), 8000);
  }, []);

  const report = useCallback(
    async (
      eventType: SecurityEventType,
      metadata?: Record<string, unknown>,
      warnKind?: "leave" | "clipboard" | "fullscreen",
    ) => {
      if (!enabledRef.current) return;

      const now = Date.now();
      const isLeave =
        eventType === "TAB_SWITCH" ||
        eventType === "WINDOW_BLUR" ||
        eventType === "FULLSCREEN_EXIT";

      if (isLeave) {
        if (now - lastLeaveAtRef.current < SECURITY_LEAVE_DEDUP_MS) return;
        lastLeaveAtRef.current = now;
      } else {
        const last = lastSentRef.current[eventType] ?? 0;
        if (now - last < SECURITY_CLIPBOARD_DEDUP_MS) return;
      }

      lastSentRef.current[eventType] = now;

      const result = await recordExamSecurityEventAction({
        attemptId: attemptIdRef.current,
        eventType,
        metadata,
      });

      if (!result.success) return;
      if ("deduped" in result && result.deduped) return;

      violationCountRef.current += 1;
      setViolationCount(violationCountRef.current);
      showWarning(
        warnKind ??
          (eventType === "FULLSCREEN_EXIT"
            ? "fullscreen"
            : isLeave
              ? "leave"
              : "clipboard"),
      );
    },
    [showWarning],
  );

  const enterFullscreen = useCallback(async () => {
    if (!settingsRef.current.requireFullscreen) return;
    setFullscreenMessage("");
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      setFullscreenActive(Boolean(document.fullscreenElement));
    } catch {
      setFullscreenMessage(
        "Fullscreen could not be enabled by the browser. You may continue the exam, but please stay focused on this window.",
      );
      setFullscreenActive(false);
    }
  }, []);

  /**
   * Exit fullscreen after a successful final exam submit.
   * Does NOT log FULLSCREEN_EXIT — that event is only for unexpected student exits.
   * Safe if fullscreen is already exited.
   */
  const exitFullscreenAfterSubmit = useCallback(async () => {
    suppressFullscreenExitRef.current = true;
    // Stop security reporting immediately (before React re-renders / effect cleanup).
    enabledRef.current = false;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
    } finally {
      setFullscreenActive(false);
    }
  }, []);

  // If submit fails and security is re-enabled, allow future unexpected exits to be logged again.
  useEffect(() => {
    if (enabled) {
      suppressFullscreenExitRef.current = false;
      enabledRef.current = true;
    } else {
      enabledRef.current = false;
    }
  }, [enabled]);

  // Attach listeners once per enabled attempt — refs avoid remounting exam editors.
  useEffect(() => {
    if (!enabled) return;

    const onFullscreenChange = () => {
      if (!settingsRef.current.requireFullscreen) return;
      const active = Boolean(document.fullscreenElement);
      setFullscreenActive(active);
      if (!active) {
        // Intentional exit after successful submit must not count as a violation.
        if (suppressFullscreenExitRef.current) return;
        void report("FULLSCREEN_EXIT", { source: "fullscreenchange" }, "fullscreen");
      }
    };

    const onVisibility = () => {
      if (!settingsRef.current.monitorTabSwitching) return;
      if (document.visibilityState === "hidden") {
        // Prefer TAB_SWITCH over WINDOW_BLUR when both fire for one action.
        void report("TAB_SWITCH", { source: "visibilitychange" }, "leave");
      }
    };

    const onBlur = () => {
      if (!settingsRef.current.monitorTabSwitching) return;
      // If the document is already hidden, visibilitychange covers this leave.
      if (document.visibilityState === "hidden") return;
      void report("WINDOW_BLUR", { source: "blur" }, "leave");
    };

    const blockClipboard = (type: "COPY_ATTEMPT" | "PASTE_ATTEMPT" | "CUT_ATTEMPT") =>
      (e: Event) => {
        if (!settingsRef.current.blockCopyPaste) return;
        e.preventDefault();
        void report(type, { source: e.type }, "clipboard");
      };

    const onCopy = blockClipboard("COPY_ATTEMPT");
    const onPaste = blockClipboard("PASTE_ATTEMPT");
    const onCut = blockClipboard("CUT_ATTEMPT");

    const onContextMenu = (e: MouseEvent) => {
      if (!settingsRef.current.blockCopyPaste) return;
      e.preventDefault();
      void report("CONTEXT_MENU_ATTEMPT", { source: "contextmenu" }, "clipboard");
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (!settingsRef.current.blockCopyPaste) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "c") {
        e.preventDefault();
        void report("COPY_ATTEMPT", { source: "keydown" }, "clipboard");
      } else if (key === "v") {
        e.preventDefault();
        void report("PASTE_ATTEMPT", { source: "keydown" }, "clipboard");
      } else if (key === "x") {
        e.preventDefault();
        void report("CUT_ATTEMPT", { source: "keydown" }, "clipboard");
      }
      // Do not block normal typing, arrows, backspace, delete, etc.
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("copy", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("cut", onCut);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("keydown", onKeyDown);

    setFullscreenActive(Boolean(document.fullscreenElement));

    // If Start Exam requested fullscreen but navigation dropped it, surface a nudge.
    try {
      if (settings.requireFullscreen) {
        if (sessionStorage.getItem("codeshield-exam-fs-denied") === "1") {
          setFullscreenMessage(
            "Fullscreen could not be enabled by the browser. You may continue the exam, but please stay focused on this window.",
          );
          sessionStorage.removeItem("codeshield-exam-fs-denied");
        }
        if (
          sessionStorage.getItem("codeshield-exam-fs-intent") === "1" &&
          !document.fullscreenElement
        ) {
          sessionStorage.removeItem("codeshield-exam-fs-intent");
          setFullscreenMessage(
            "Please enter fullscreen mode to continue in a secure exam environment.",
          );
        } else {
          sessionStorage.removeItem("codeshield-exam-fs-intent");
        }
      } else {
        sessionStorage.removeItem("codeshield-exam-fs-intent");
        sessionStorage.removeItem("codeshield-exam-fs-denied");
      }
    } catch {
      // sessionStorage may be unavailable
    }

    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("keydown", onKeyDown);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    };
  }, [enabled, attemptId, report]);

  return {
    warning,
    violationCount,
    fullscreenActive,
    fullscreenMessage,
    enterFullscreen,
    exitFullscreenAfterSubmit,
    dismissWarning: () => setWarning(null),
  };
}
