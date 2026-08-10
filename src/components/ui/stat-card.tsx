import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  return (
    <div className="card-soft p-5 flex flex-col gap-3 hover:shadow-elevated transition-shadow">
      <div className="flex items-start justify-between">
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        {Icon && (
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center",
              tone === "success" && "bg-success-soft text-success",
              tone === "warning" && "bg-warning-soft text-warning",
              tone === "danger" && "bg-danger-soft text-danger",
              tone === "default" && "bg-primary-soft text-primary",
            )}
          >
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-2xl font-display font-bold tracking-tight">{value}</div>
      {delta && (
        <div className="text-xs font-semibold text-success">{delta}</div>
      )}
    </div>
  );
}
