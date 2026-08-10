import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { mockAlerts, mockMonitoringFeeds } from "@/lib/mock-data";
import { initials } from "@/lib/utils";

export default function AdminMonitoringPage() {
  return (
    <div>
      <PageHeader
        title="AI Monitoring Center"
        description="Real-time proctoring across active assessments."
        actions={
          <span className="text-xs font-semibold text-success">● LIVE · 8 feeds</span>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Sessions" value="48" />
        <StatCard label="Safe" value="36" tone="success" />
        <StatCard label="Warnings" value="9" tone="warning" />
        <StatCard label="Violations" value="3" tone="danger" />
      </div>

      <h3 className="font-display font-bold mb-3">Live Webcam Feeds</h3>
      <div className="flex gap-2 mb-4 text-xs font-semibold">
        <span className="px-2 py-1 rounded-lg bg-success-soft text-success">Safe</span>
        <span className="px-2 py-1 rounded-lg bg-warning-soft text-warning">Warning</span>
        <span className="px-2 py-1 rounded-lg bg-danger-soft text-danger">Violation</span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {mockMonitoringFeeds.map((f) => (
          <div key={f.name} className="card-soft p-4">
            <div className="aspect-video rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center relative mb-3">
              <div className="absolute top-2 left-2 text-[10px] font-bold bg-black/50 px-2 py-0.5 rounded">
                FACE {f.face}%
              </div>
              <div className="absolute top-2 right-2 text-[10px] font-bold text-danger">LIVE</div>
              <div className="w-14 h-14 rounded-full bg-primary/30 flex items-center justify-center font-bold">
                {initials(f.name)}
              </div>
            </div>
            <div className="font-semibold text-sm">{f.name}</div>
            <div className="text-[11px] text-muted-foreground">00:42:18</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {f.flags.map((flag) => (
                <span
                  key={flag}
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-muted"
                >
                  {flag.includes("⚠") ? flag : `${flag} ✓`}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card-soft p-5 lg:col-span-2">
          <h3 className="font-display font-bold mb-4">Security Event Stream</h3>
          <div className="space-y-2 max-h-[360px] overflow-y-auto">
            {mockAlerts.map((a, i) => (
              <div
                key={`${a.type}-${i}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{a.type}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {a.student} · {a.assessment}
                  </div>
                </div>
                <span className="text-[11px] font-semibold capitalize">{a.severity}</span>
                <span className="text-[11px] text-muted-foreground">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">System Health</h3>
          {[
            ["Camera Streams", "98%"],
            ["Microphones", "96%"],
            ["Screen Recording", "100%"],
            ["Network", "Stable"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-sm">
              <span className="text-muted-foreground">{k}</span>
              <span className="font-semibold">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
