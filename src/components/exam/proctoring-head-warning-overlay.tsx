"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  title: string;
  body: string;
  support: string;
  level: 1 | 2;
};

/**
 * Prominent non-blocking head-position warning.
 * pointer-events-none keeps the exam interactive underneath.
 */
export function ProctoringHeadWarningOverlay({
  open,
  title,
  body,
  support,
  level,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center p-4 pointer-events-none"
      aria-hidden={false}
    >
      <div
        role="alert"
        aria-live="assertive"
        className={cn(
          "pointer-events-auto w-full max-w-md rounded-2xl border-2 shadow-elevated px-6 py-5 text-center transition-opacity duration-200",
          level >= 2
            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/90"
            : "border-amber-400 bg-amber-50/95 dark:bg-amber-950/85",
        )}
      >
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
          <AlertTriangle
            className="h-7 w-7 text-amber-600 dark:text-amber-400"
            aria-hidden
          />
        </div>
        <p className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2">
          Attention
        </p>
        <h2 className="font-display font-bold text-lg text-amber-950 dark:text-amber-50">
          {title}
        </h2>
        <p className="mt-3 text-sm text-amber-900/90 dark:text-amber-100/90 leading-relaxed">
          {body}
        </p>
        <p className="mt-2 text-sm font-medium text-amber-800 dark:text-amber-200">
          {support}
        </p>
      </div>
    </div>
  );
}
