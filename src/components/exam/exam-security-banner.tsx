"use client";

import { AlertTriangle, Maximize } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExamSecurityWarning } from "@/hooks/use-exam-security";

export function ExamSecurityBanner({
  warning,
  fullscreenActive,
  fullscreenMessage,
  onEnterFullscreen,
  onDismiss,
}: {
  warning: ExamSecurityWarning;
  fullscreenActive: boolean;
  fullscreenMessage: string;
  onEnterFullscreen: () => void;
  onDismiss: () => void;
}) {
  if (!warning && fullscreenActive && !fullscreenMessage) return null;

  return (
    <div className="relative z-20 space-y-2 px-4 pt-3 max-w-6xl mx-auto">
      {fullscreenMessage && !fullscreenActive && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            {fullscreenMessage}
          </p>
          <Button size="sm" variant="outline" onClick={onEnterFullscreen}>
            <Maximize className="w-4 h-4" />
            Enter fullscreen
          </Button>
        </div>
      )}

      {warning && (
        <div
          className="rounded-xl border border-danger/40 bg-danger-soft px-4 py-3 flex flex-wrap items-start justify-between gap-3"
          role="alert"
        >
          <div className="flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 text-danger mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-danger">{warning.message}</p>
          </div>
          <div className="flex items-center gap-2">
            {!fullscreenActive && warning.level && (
              <Button size="sm" variant="outline" onClick={onEnterFullscreen}>
                <Maximize className="w-4 h-4" />
                Return to fullscreen
              </Button>
            )}
            <button
              type="button"
              className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
