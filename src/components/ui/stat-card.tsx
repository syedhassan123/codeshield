// import type { LucideIcon } from "lucide-react";
// import { cn } from "@/lib/utils";

// export function StatCard({
//   label,
//   value,
//   delta,
//   icon: Icon,
//   tone = "default",
//   emphasis = false,
// }: {
//   label: string;
//   value: string | number;
//   delta?: string;
//   icon?: LucideIcon;
//   tone?: "default" | "success" | "warning" | "danger";
//   /** Primary KPI row — slightly stronger surface */
//   emphasis?: boolean;
// }) {
//   return (
//     <div
//       className={cn(
//         "card-soft p-4 flex flex-col gap-1.5 transition-shadow hover:shadow-soft",
//         emphasis && "ring-1 ring-primary/8",
//       )}
//     >
//       <div className="flex items-start justify-between gap-2">
//         <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-snug">
//           {label}
//         </div>
//         {Icon && (
//           <div
//             className={cn(
//               "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
//               tone === "success" && "bg-success-soft text-success",
//               tone === "warning" && "bg-warning-soft text-warning",
//               tone === "danger" && "bg-danger-soft text-danger",
//               tone === "default" && "bg-primary-soft text-primary",
//             )}
//           >
//             <Icon className="w-3.5 h-3.5" />
//           </div>
//         )}
//       </div>
//       <div className="text-xl sm:text-2xl font-display font-bold tracking-tight leading-none pt-0.5">
//         {value}
//       </div>
//       {delta && (
//         <div className="text-[11px] font-semibold text-success">{delta}</div>
//       )}
//     </div>
//   );
// }









import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* Complete class strings (never interpolated) so Tailwind can detect every one. */
const TONE: Record<
  "default" | "success" | "warning" | "danger",
  { chip: string; glow: string; dot: string; bar: string }
> = {
  default: {
    chip: "bg-primary-soft text-primary ring-primary/20",
    glow: "bg-primary/20",
    dot: "bg-primary ring-primary/20",
    bar: "from-primary to-[#2e83fb]",
  },
  success: {
    chip: "bg-success-soft text-success ring-success/20",
    glow: "bg-success/20",
    dot: "bg-success ring-success/20",
    bar: "from-success to-success/40",
  },
  warning: {
    chip: "bg-warning-soft text-warning ring-warning/20",
    glow: "bg-warning/20",
    dot: "bg-warning ring-warning/20",
    bar: "from-warning to-warning/40",
  },
  danger: {
    chip: "bg-danger-soft text-danger ring-danger/20",
    glow: "bg-danger/20",
    dot: "bg-danger ring-danger/20",
    bar: "from-danger to-danger/40",
  },
};

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
  const t = TONE[tone];

  return (
    <div
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-2xl border border-white/70 bg-card/80 p-4 ring-1 backdrop-blur-xl",
        emphasis ? "ring-primary/20" : "ring-black/[0.035]",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset,0_8px_24px_-14px_rgba(30,41,90,0.2)]",
        "transition-all duration-300 ease-out hover:-translate-y-0.5",
        "hover:shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset,0_18px_36px_-16px_rgba(79,85,243,0.35)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      )}
    >
      {/* Tone-coloured light in the corner — brightens on hover */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full blur-3xl transition-all duration-500 group-hover:scale-125 group-hover:opacity-100",
          emphasis ? "opacity-70" : "opacity-40",
          t.glow,
        )}
      />
      {/* Accent line that draws across the bottom edge on hover */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 h-[3px] w-0 rounded-r-full bg-gradient-to-r transition-all duration-500 ease-out group-hover:w-full",
          t.bar,
        )}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {tone !== "default" && (
            <span
              aria-hidden
              className={cn("h-1.5 w-1.5 shrink-0 rounded-full ring-4", t.dot)}
            />
          )}
          <div className="text-xs font-medium leading-snug text-muted-foreground transition-colors duration-300 group-hover:text-foreground/80">
            {label}
          </div>
        </div>
        {Icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 transition-all duration-300 group-hover:-rotate-6 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:transform-none",
              t.chip,
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
          </div>
        )}
      </div>

      <div
        className={cn(
          "relative break-words pb-0.5 pt-0.5 font-display font-bold leading-[1.1] tracking-tight text-foreground tabular-nums",
          emphasis ? "text-2xl sm:text-[28px]" : "text-xl sm:text-2xl",
        )}
      >
        {value}
      </div>

      {delta && (
        <div className="relative inline-flex w-fit items-center rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success ring-1 ring-success/20">
          {delta}
        </div>
      )}
    </div>
  );
}