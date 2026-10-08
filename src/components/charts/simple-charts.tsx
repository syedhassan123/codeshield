// "use client";

// import {
//   Area,
//   AreaChart,
//   Bar,
//   BarChart,
//   CartesianGrid,
//   ResponsiveContainer,
//   Tooltip,
//   XAxis,
//   YAxis,
// } from "recharts";

// export type ChartPoint = { name: string; value: number };
// export type GrowthPoint = {
//   name: string;
//   students: number;
//   interviewers: number;
// };
// export type SecuritySegment = { label: string; value: number; color: string };

// function ChartTooltip({
//   active,
//   payload,
//   label,
// }: {
//   active?: boolean;
//   payload?: Array<{ value?: number; name?: string; color?: string }>;
//   label?: string;
// }) {
//   if (!active || !payload?.length) return null;
//   return (
//     <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-soft text-xs">
//       {label && (
//         <p className="font-semibold text-foreground mb-1">{label}</p>
//       )}
//       {payload.map((entry) => (
//         <p key={String(entry.name)} className="text-muted-foreground">
//           <span
//             className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
//             style={{ background: entry.color || "var(--primary)" }}
//           />
//           {entry.name}:{" "}
//           <span className="font-semibold text-foreground">{entry.value}</span>
//         </p>
//       ))}
//     </div>
//   );
// }

// type ChartHeight = "sm" | "md" | "lg";

// const heightClass: Record<ChartHeight, string> = {
//   sm: "h-44",
//   md: "h-52",
//   lg: "h-56",
// };

// export function ActivityAreaChart({
//   data = [],
//   height = "md",
//   emptyLabel = "No attempt activity in the last 7 days.",
//   seriesName = "Activity",
// }: {
//   data?: ChartPoint[];
//   height?: ChartHeight;
//   emptyLabel?: string;
//   seriesName?: string;
// }) {
//   return (
//     <div className={heightClass[height]}>
//       {data.length ? (
//         <ResponsiveContainer width="100%" height="100%">
//           <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
//             <defs>
//               <linearGradient id="activity" x1="0" y1="0" x2="0" y2="1">
//                 <stop offset="0%" stopColor="#4f55f3" stopOpacity={0.3} />
//                 <stop offset="100%" stopColor="#4f55f3" stopOpacity={0} />
//               </linearGradient>
//             </defs>
//             <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
//             <XAxis
//               dataKey="name"
//               tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
//               axisLine={false}
//               tickLine={false}
//             />
//             <YAxis
//               tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
//               allowDecimals={false}
//               axisLine={false}
//               tickLine={false}
//             />
//             <Tooltip content={<ChartTooltip />} />
//             <Area
//               type="monotone"
//               dataKey="value"
//               name={seriesName}
//               stroke="#4f55f3"
//               fill="url(#activity)"
//               strokeWidth={2}
//             />
//           </AreaChart>
//         </ResponsiveContainer>
//       ) : (
//         <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
//           {emptyLabel}
//         </div>
//       )}
//     </div>
//   );
// }

// export function GrowthBarChart({
//   data = [],
//   height = "md",
// }: {
//   data?: GrowthPoint[];
//   height?: ChartHeight;
// }) {
//   return (
//     <div className={heightClass[height]}>
//       {data.length ? (
//         <ResponsiveContainer width="100%" height="100%">
//           <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
//             <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
//             <XAxis
//               dataKey="name"
//               tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
//               axisLine={false}
//               tickLine={false}
//             />
//             <YAxis
//               tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
//               allowDecimals={false}
//               axisLine={false}
//               tickLine={false}
//             />
//             <Tooltip content={<ChartTooltip />} />
//             <Bar
//               dataKey="students"
//               name="Students"
//               fill="#4f55f3"
//               radius={[4, 4, 0, 0]}
//               maxBarSize={36}
//             />
//             <Bar
//               dataKey="interviewers"
//               name="Interviewers"
//               fill="#2e83fb"
//               radius={[4, 4, 0, 0]}
//               maxBarSize={36}
//             />
//           </BarChart>
//         </ResponsiveContainer>
//       ) : (
//         <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
//           No user registrations in this period.
//         </div>
//       )}
//     </div>
//   );
// }

// export function LanguageBarChart({
//   data = [],
//   height = "sm",
//   seriesName = "Submissions",
//   emptyLabel = "No coding submissions yet.",
//   axisWidth = 72,
// }: {
//   data?: ChartPoint[];
//   height?: ChartHeight;
//   seriesName?: string;
//   emptyLabel?: string;
//   axisWidth?: number;
// }) {
//   return (
//     <div className={heightClass[height]}>
//       {data.length ? (
//         <ResponsiveContainer width="100%" height="100%">
//           <BarChart
//             data={data}
//             layout="vertical"
//             margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
//           >
//             <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" horizontal={false} />
//             <XAxis
//               type="number"
//               tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
//               axisLine={false}
//               tickLine={false}
//               allowDecimals={false}
//             />
//             <YAxis
//               type="category"
//               dataKey="name"
//               tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
//               axisLine={false}
//               tickLine={false}
//               width={axisWidth}
//             />
//             <Tooltip content={<ChartTooltip />} />
//             <Bar
//               dataKey="value"
//               name={seriesName}
//               fill="#436df7"
//               radius={[0, 4, 4, 0]}
//               maxBarSize={20}
//             />
//           </BarChart>
//         </ResponsiveContainer>
//       ) : (
//         <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
//           {emptyLabel}
//         </div>
//       )}
//     </div>
//   );
// }

// /** Horizontal score bars with full labels. Used where a Recharts axis would clip long names. */
// export function ScoreBarList({
//   data = [],
//   emptyLabel = "No completed results yet.",
// }: {
//   data?: ChartPoint[];
//   emptyLabel?: string;
// }) {
//   if (!data.length) {
//     return (
//       <div className="h-44 flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
//         {emptyLabel}
//       </div>
//     );
//   }

//   return (
//     <div className="space-y-3 py-1">
//       {data.map((point) => (
//         <div key={point.name}>
//           <div className="text-xs font-semibold text-foreground mb-1.5" title={point.name}>
//             {point.name}
//           </div>
//           <div className="flex items-center gap-3">
//             <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
//               <div
//                 className="h-full rounded-full bg-primary"
//                 style={{ width: `${Math.max(0, Math.min(100, point.value))}%` }}
//               />
//             </div>
//             <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-9 text-right">
//               {point.value}%
//             </span>
//           </div>
//         </div>
//       ))}
//     </div>
//   );
// }

// export function SecurityDonut({ segments = [] }: { segments?: SecuritySegment[] }) {
//   return (
//     <div className="space-y-3.5 py-1">
//       {segments.length ? (
//         segments.map((segment) => (
//           <div key={segment.label}>
//             <div className="flex items-center justify-between text-xs mb-1.5">
//               <span className="font-semibold text-foreground">{segment.label}</span>
//               <span className="text-muted-foreground tabular-nums">
//                 {segment.value}%
//               </span>
//             </div>
//             <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
//               <div
//                 className="h-full rounded-full transition-[width] duration-300"
//                 style={{ width: `${segment.value}%`, background: segment.color }}
//               />
//             </div>
//           </div>
//         ))
//       ) : (
//         <div className="text-sm text-muted-foreground py-8 text-center">
//           No active sessions to summarize.
//         </div>
//       )}
//     </div>
//   );
// }

















"use client";

import type { LucideIcon } from "lucide-react";
import { Activity, Code, Shield, Trophy, Users } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

export type ChartPoint = { name: string; value: number };
export type GrowthPoint = {
  name: string;
  students: number;
  interviewers: number;
};
export type SecuritySegment = { label: string; value: number; color: string };

/* ───────────────────────── Palette & shared helpers ───────────────────────── */

// Same hues as before — now used for gradients.
const BRAND = "#4f55f3";
const SKY = "#2e83fb";
const BLUE = "#436df7";
const GRID = "#e8edf5";

/** Gradient fills can't be painted as CSS colours, so map them back for dots. */
const SWATCH: Record<string, string> = {
  "url(#cs-students)": BRAND,
  "url(#cs-interviewers)": SKY,
  "url(#cs-language)": BLUE,
};

function dotColor(color?: string) {
  if (!color) return "var(--primary)";
  return SWATCH[color] ?? (color.startsWith("url(") ? "var(--primary)" : color);
}

const axisTick = { fontSize: 11, fill: "var(--muted-foreground)" };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[8.5rem] rounded-xl border border-white/70 bg-card/90 px-3 py-2.5 text-xs shadow-[0_16px_40px_-14px_rgba(30,41,90,0.38)] ring-1 ring-black/5 backdrop-blur-xl">
      {label && (
        <p className="mb-1.5 border-b border-border/60 pb-1.5 font-display text-xs font-semibold text-foreground">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <p
            key={String(entry.name)}
            className="flex items-center justify-between gap-4 text-muted-foreground"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full ring-2 ring-white"
                style={{ background: dotColor(entry.color) }}
              />
              {entry.name}
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {entry.value}
            </span>
          </p>
        ))}
      </div>
    </div>
  );
}

function ChartLegend({
  payload,
}: {
  payload?: Array<{ value?: string; color?: string }>;
}) {
  if (!payload?.length) return null;
  return (
    <ul className="flex items-center justify-end gap-3 pb-1">
      {payload.map((entry) => (
        <li
          key={String(entry.value)}
          className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground"
        >
          <span
            aria-hidden
            className="h-2 w-2 rounded-full"
            style={{ background: dotColor(entry.color) }}
          />
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

type ChartHeight = "sm" | "md" | "lg";

const heightClass: Record<ChartHeight, string> = {
  sm: "h-44",
  md: "h-52",
  lg: "h-56",
};

/** Shared empty state: says what's missing and what will fill it. */
function EmptyState({
  icon: Icon,
  label,
  hint,
  className,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-col items-center justify-center gap-3 overflow-hidden rounded-xl border border-dashed border-border bg-gradient-to-b from-muted/50 to-transparent px-4 py-6 text-center",
        className,
      )}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70 [background-image:radial-gradient(circle_at_1px_1px,rgba(100,116,170,0.22)_1px,transparent_0)] [background-size:14px_14px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_72%)]"
      />
      <span className="relative flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-soft text-primary ring-1 ring-primary/20">
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse rounded-2xl bg-primary/10 motion-reduce:animate-none"
        />
        <Icon className="relative h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="relative space-y-1">
        <p className="max-w-[17rem] text-sm font-medium text-foreground/80">
          {label}
        </p>
        {hint && (
          <p className="max-w-[17rem] text-xs text-muted-foreground">{hint}</p>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────── Charts ───────────────────────────────── */

export function ActivityAreaChart({
  data = [],
  height = "md",
  emptyLabel = "No attempt activity in the last 7 days.",
  seriesName = "Activity",
}: {
  data?: ChartPoint[];
  height?: ChartHeight;
  emptyLabel?: string;
  seriesName?: string;
}) {
  return (
    <div
      className={cn(
        heightClass[height],
        "[&_.recharts-area-curve]:drop-shadow-[0_6px_8px_rgba(79,85,243,0.28)]",
      )}
    >
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 8, right: 8, left: -18, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cs-activity-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={0.38} />
                <stop offset="55%" stopColor={SKY} stopOpacity={0.12} />
                <stop offset="100%" stopColor={SKY} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              tick={axisTick}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{
                stroke: BRAND,
                strokeOpacity: 0.25,
                strokeDasharray: "4 4",
              }}
            />
            <Area
              type="monotone"
              dataKey="value"
              name={seriesName}
              stroke={BRAND}
              fill="url(#cs-activity-fill)"
              strokeWidth={2.5}
              activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: BRAND }}
              animationDuration={900}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState
          icon={Activity}
          label={emptyLabel}
          hint="Attempts show up here as soon as students start an assessment."
          className="h-full"
        />
      )}
    </div>
  );
}

export function GrowthBarChart({
  data = [],
  height = "md",
}: {
  data?: GrowthPoint[];
  height?: ChartHeight;
}) {
  return (
    <div className={heightClass[height]}>
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: -18, bottom: 0 }}
            barGap={4}
          >
            <defs>
              <linearGradient id="cs-students" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={BRAND} stopOpacity={1} />
                <stop offset="100%" stopColor={BRAND} stopOpacity={0.55} />
              </linearGradient>
              <linearGradient id="cs-interviewers" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SKY} stopOpacity={1} />
                <stop offset="100%" stopColor={SKY} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
            <XAxis
              dataKey="name"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />
            <YAxis
              tick={axisTick}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(79,85,243,0.06)" }}
            />
            <Legend verticalAlign="top" align="right" height={28} content={<ChartLegend />} />
            <Bar
              dataKey="students"
              name="Students"
              fill="url(#cs-students)"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
              animationDuration={800}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="interviewers"
              name="Interviewers"
              fill="url(#cs-interviewers)"
              radius={[6, 6, 0, 0]}
              maxBarSize={32}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState
          icon={Users}
          label="No user registrations in this period."
          hint="Sign-ups will chart here as students and interviewers register."
          className="h-full"
        />
      )}
    </div>
  );
}

export function LanguageBarChart({
  data = [],
  height = "sm",
  seriesName = "Submissions",
  emptyLabel = "No coding submissions yet.",
  axisWidth = 72,
}: {
  data?: ChartPoint[];
  height?: ChartHeight;
  seriesName?: string;
  emptyLabel?: string;
  axisWidth?: number;
}) {
  return (
    <div className={heightClass[height]}>
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 28, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="cs-language" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={BLUE} stopOpacity={0.7} />
                <stop offset="100%" stopColor={SKY} stopOpacity={1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
            <XAxis
              type="number"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={axisTick}
              axisLine={false}
              tickLine={false}
              width={axisWidth}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "rgba(67,109,247,0.07)" }}
            />
            <Bar
              dataKey="value"
              name={seriesName}
              fill="url(#cs-language)"
              radius={[0, 8, 8, 0]}
              maxBarSize={18}
              animationDuration={800}
              animationEasing="ease-out"
            >
              <LabelList
                dataKey="value"
                position="right"
                fontSize={11}
                fontWeight={600}
                fill="var(--muted-foreground)"
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <EmptyState
          icon={Code}
          label={emptyLabel}
          hint="Submissions will chart here once students start writing code."
          className="h-full"
        />
      )}
    </div>
  );
}

/** Horizontal score bars with full labels. Used where a Recharts axis would clip long names. */
export function ScoreBarList({
  data = [],
  emptyLabel = "No completed results yet.",
}: {
  data?: ChartPoint[];
  emptyLabel?: string;
}) {
  if (!data.length) {
    return (
      <EmptyState
        icon={Trophy}
        label={emptyLabel}
        hint="Scores appear here once evaluations are completed."
        className="h-44"
      />
    );
  }

  return (
    <ul className="space-y-1 py-0.5">
      {data.map((point) => {
        const width = Math.max(0, Math.min(100, point.value));
        return (
          <li
            key={point.name}
            className="group/row -mx-2 rounded-xl px-2 py-2 transition-colors duration-200 hover:bg-primary/[0.05]"
          >
            <div
              className="mb-1.5 text-xs font-semibold text-foreground"
              title={point.name}
            >
              {point.name}
            </div>
            <div className="flex items-center gap-3">
              <div
                role="progressbar"
                aria-label={point.name}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={width}
                className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-black/[0.03]"
              >
                <div
                  className="relative h-full rounded-full bg-gradient-to-r from-primary to-[#2e83fb] transition-[width,filter] duration-700 ease-out group-hover/row:brightness-110"
                  style={{ width: `${width}%` }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-x-1.5 top-[3px] h-px rounded-full bg-white/50"
                  />
                </div>
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums text-foreground/80">
                {point.value}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SecurityDonut({ segments = [] }: { segments?: SecuritySegment[] }) {
  // Ring geometry (viewBox is 120 × 120)
  const R = 46;
  const STROKE = 11;
  const CIRC = 2 * Math.PI * R;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  const gap = segments.length > 1 ? 3 : 0;

  const top = segments.reduce<SecuritySegment | undefined>(
    (best, s) => (!best || s.value > best.value ? s : best),
    undefined,
  );

  const arcs = segments.map((segment, i) => {
    const length = (segment.value / total) * CIRC;
    const start = segments
      .slice(0, i)
      .reduce((sum, s) => sum + (s.value / total) * CIRC, 0);
    return { segment, dash: Math.max(0, length - gap), start };
  });

  return (
    <div className="py-1">
      {segments.length ? (
        <div className="flex items-center gap-4 lg:flex-col lg:gap-5 xl:flex-row">
          {/* Ring */}
          <div className="relative h-28 w-28 shrink-0">
            <svg
              viewBox="0 0 120 120"
              role="img"
              aria-label={segments.map((s) => `${s.label} ${s.value}%`).join(", ")}
              className="h-full w-full drop-shadow-[0_6px_10px_rgba(79,85,243,0.18)]"
            >
              <g transform="rotate(-90 60 60)">
                <circle
                  cx="60"
                  cy="60"
                  r={R}
                  fill="none"
                  strokeWidth={STROKE}
                  className="stroke-muted"
                />
                {arcs.map(({ segment, dash, start }) => (
                  <circle
                    key={segment.label}
                    cx="60"
                    cy="60"
                    r={R}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${CIRC - dash}`}
                    strokeDashoffset={-start}
                    className="cursor-pointer transition-opacity duration-200 hover:opacity-80"
                  >
                    <title>{`${segment.label}: ${segment.value}%`}</title>
                    <animate
                      attributeName="stroke-dasharray"
                      from={`0 ${CIRC}`}
                      to={`${dash} ${CIRC - dash}`}
                      dur="0.9s"
                      fill="freeze"
                      calcMode="spline"
                      keyTimes="0;1"
                      keySplines="0.22 1 0.36 1"
                    />
                  </circle>
                ))}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <Shield className="mb-0.5 h-4 w-4 text-primary" aria-hidden />
              <span className="font-display text-xl font-bold leading-none tracking-tight text-foreground tabular-nums">
                {top?.value}%
              </span>
              <span className="mt-1 max-w-[4.5rem] truncate text-[11px] font-medium text-muted-foreground">
                {top?.label}
              </span>
            </div>
          </div>

          {/* Legend */}
          <ul className="w-full min-w-0 flex-1 space-y-3 lg:flex-none xl:flex-1">
            {segments.map((segment) => (
              <li key={segment.label} className="group/seg">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-foreground">
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full ring-2 ring-white"
                      style={{ background: segment.color }}
                    />
                    <span className="truncate">{segment.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted-foreground transition-colors group-hover/seg:text-foreground">
                    {segment.value}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width,filter] duration-500 group-hover/seg:brightness-110"
                    style={{ width: `${segment.value}%`, background: segment.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <EmptyState
          icon={Shield}
          label="No active sessions to summarize."
          hint="Session checks appear here once students are taking assessments."
          className="min-h-[11rem]"
        />
      )}
    </div>
  );
}