"use client";

import { cn } from "@/lib/utils";
import type { SecuritySummary } from "@/lib/exam/security";
import type { SerializedSecurityEvent } from "@/lib/actions/exam-security";

function riskClass(level: string) {
  if (level === "HIGH") return "text-danger bg-danger-soft";
  if (level === "MEDIUM") return "text-amber-800 bg-amber-500/15";
  return "text-success bg-success-soft";
}

function formatEventLabel(type: string) {
  return type.replaceAll("_", " ");
}

export function AdminSecurityReport({
  summary,
  events,
}: {
  summary: SecuritySummary;
  events: SerializedSecurityEvent[];
}) {
  const { counts, totalViolations, riskLevel } = summary;

  return (
    <div className="card-soft p-5 mb-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold">Security Events</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Browser activity signals only — not a confirmed cheating score.
          </p>
        </div>
        <span
          className={cn(
            "text-xs font-semibold uppercase px-2.5 py-1 rounded-lg",
            riskClass(riskLevel),
          )}
        >
          Security Risk Level: {riskLevel}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Stat label="Total events" value={String(totalViolations)} />
        <Stat label="Tab switches" value={String(counts.TAB_SWITCH)} />
        <Stat label="Copy attempts" value={String(counts.COPY_ATTEMPT)} />
        <Stat label="Paste attempts" value={String(counts.PASTE_ATTEMPT)} />
        <Stat label="Cut attempts" value={String(counts.CUT_ATTEMPT)} />
        <Stat label="Fullscreen exits" value={String(counts.FULLSCREEN_EXIT)} />
        <Stat
          label="Context menu"
          value={String(counts.CONTEXT_MENU_ATTEMPT)}
        />
        <Stat label="Window blur" value={String(counts.WINDOW_BLUR)} />
        <Stat
          label="Camera issues"
          value={String(
            (counts.CAMERA_PERMISSION_DENIED ?? 0) +
              (counts.CAMERA_UNAVAILABLE ?? 0) +
              (counts.CAMERA_DISCONNECTED ?? 0),
          )}
        />
        <Stat
          label="Upload failures"
          value={String(counts.RECORDING_UPLOAD_FAILED ?? 0)}
        />
      </div>

      <h4 className="text-sm font-semibold mb-3">Event timeline</h4>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No security events recorded for this attempt.
        </p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {events.map((event) => (
            <li
              key={event.id}
              className="rounded-xl border border-border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <p className="text-sm font-semibold">
                  {formatEventLabel(event.eventType)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(event.timestamp).toLocaleString()}
                </p>
              </div>
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase px-2 py-1 rounded-md",
                  riskClass(event.severity),
                )}
              >
                Severity: {event.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="font-display font-bold text-lg mt-0.5">{value}</div>
    </div>
  );
}
