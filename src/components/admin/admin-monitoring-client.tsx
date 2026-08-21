"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { getAdminMonitoringAction } from "@/lib/actions/admin";
import { formatDurationMs } from "@/lib/admin/format";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { cn, initials } from "@/lib/utils";

type MonitoringPayload = {
  summary: {
    activeSessions: number;
    safe: number;
    warnings: number;
    violations: number;
  };
  sessions: Array<{
    attemptId: string;
    studentName: string;
    assessmentTitle: string;
    elapsedMs: number;
    riskLevel: "LOW" | "MEDIUM" | "HIGH";
    violationCount: number;
    flags: string[];
    status: "safe" | "warning" | "violation";
  }>;
  events: Array<{
    id: string;
    type: string;
    severity: string;
    student: string;
    assessment: string;
    time: string;
  }>;
  systemHealth: ReadonlyArray<readonly [string, string]>;
};

const REFRESH_MS = 30000;

export function AdminMonitoringClient() {
  const [data, setData] = useState<MonitoringPayload | null>(null);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = () => {
    setError("");
    startTransition(async () => {
      const result = await getAdminMonitoringAction();
      if ("error" in result && result.error) {
        setError(result.error);
        setLoaded(true);
        return;
      }
      if ("summary" in result) {
        setData(result as MonitoringPayload);
      }
      setLoaded(true);
    });
  };

  useEffect(() => {
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  const summary = data?.summary ?? {
    activeSessions: 0,
    safe: 0,
    warnings: 0,
    violations: 0,
  };

  return (
    <div>
      <PageHeader
        title="AI Monitoring Center"
        description="Real-time proctoring across active assessments."
        actions={
          <span className="text-xs font-semibold text-success">
            ● LIVE · {summary.activeSessions} session
            {summary.activeSessions === 1 ? "" : "s"}
            {pending ? " · refreshing…" : ""}
          </span>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Sessions" value={summary.activeSessions} />
        <StatCard label="Safe" value={summary.safe} tone="success" />
        <StatCard label="Warnings" value={summary.warnings} tone="warning" />
        <StatCard label="Violations" value={summary.violations} tone="danger" />
      </div>

      <h3 className="font-display font-bold mb-3">Live Webcam Feeds</h3>
      <div className="flex gap-2 mb-4 text-xs font-semibold">
        <span className="px-2 py-1 rounded-lg bg-success-soft text-success">Safe</span>
        <span className="px-2 py-1 rounded-lg bg-warning-soft text-warning">Warning</span>
        <span className="px-2 py-1 rounded-lg bg-danger-soft text-danger">Violation</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {data?.sessions.length ? (
          data.sessions.map((session) => (
            <Link
              key={session.attemptId}
              href={`/admin/results/${session.attemptId}`}
              className="card-soft p-4 hover:shadow-elevated transition-shadow"
            >
              <div
                className={cn(
                  "aspect-video rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center relative mb-3 border-2",
                  session.status === "safe" && "border-success/40",
                  session.status === "warning" && "border-warning/50",
                  session.status === "violation" && "border-danger/50",
                )}
              >
                <div className="absolute top-2 left-2 text-[10px] font-bold bg-black/50 px-2 py-0.5 rounded">
                  RISK {session.riskLevel}
                </div>
                <div className="absolute top-2 right-2 text-[10px] font-bold text-danger">
                  LIVE
                </div>
                <div className="w-14 h-14 rounded-full bg-primary/30 flex items-center justify-center font-bold">
                  {initials(session.studentName)}
                </div>
              </div>
              <div className="font-semibold text-sm">{session.studentName}</div>
              <div className="text-[11px] text-muted-foreground truncate">
                {session.assessmentTitle}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {formatDurationMs(session.elapsedMs)}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {session.flags.map((flag) => (
                  <span
                    key={flag}
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted"
                  >
                    {flag.includes("⚠") ? flag : `${flag} ✓`}
                  </span>
                ))}
              </div>
            </Link>
          ))
        ) : (
          <div className="card-soft p-6 sm:col-span-2 lg:col-span-4 text-sm text-muted-foreground">
            {loaded ? "No active exam sessions right now." : "Loading active sessions…"}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card-soft p-5 lg:col-span-2">
          <h3 className="font-display font-bold mb-4">Security Event Stream</h3>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {data?.events.length ? (
              data.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold">{event.type}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {event.student} · {event.assessment}
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold capitalize">
                    {event.severity}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {event.time}
                  </span>
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground py-6 text-center">
                {loaded ? "No security events recorded yet." : "Loading events…"}
              </div>
            )}
          </div>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">System Health</h3>
          {(data?.systemHealth ?? []).map(([label, value]) => (
            <div
              key={label}
              className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm"
            >
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-danger mt-4">{error}</p>}
    </div>
  );
}
