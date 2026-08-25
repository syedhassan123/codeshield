import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
  emphasis = false,
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
  /** Primary KPI row — slightly stronger surface */
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "card-soft p-4 flex flex-col gap-1.5 transition-shadow hover:shadow-soft",
        emphasis && "ring-1 ring-primary/8",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-snug">
          {label}
        </div>
        {Icon && (
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              tone === "success" && "bg-success-soft text-success",
              tone === "warning" && "bg-warning-soft text-warning",
              tone === "danger" && "bg-danger-soft text-danger",
              tone === "default" && "bg-primary-soft text-primary",
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-display font-bold tracking-tight leading-none pt-0.5">
        {value}
      </div>
      {delta && (
        <div className="text-[11px] font-semibold text-success">{delta}</div>
      )}
    </div>
  );
}
