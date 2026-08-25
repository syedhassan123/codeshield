"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = { name: string; value: number };
export type GrowthPoint = {
  name: string;
  students: number;
  interviewers: number;
};
export type SecuritySegment = { label: string; value: number; color: string };

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
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-soft text-xs">
      {label && (
        <p className="font-semibold text-foreground mb-1">{label}</p>
      )}
      {payload.map((entry) => (
        <p key={String(entry.name)} className="text-muted-foreground">
          <span
            className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
            style={{ background: entry.color || "var(--primary)" }}
          />
          {entry.name}:{" "}
          <span className="font-semibold text-foreground">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

type ChartHeight = "sm" | "md" | "lg";

const heightClass: Record<ChartHeight, string> = {
  sm: "h-44",
  md: "h-52",
  lg: "h-56",
};

export function ActivityAreaChart({
  data = [],
  height = "md",
  emptyLabel = "No attempt activity in the last 7 days.",
}: {
  data?: ChartPoint[];
  height?: ChartHeight;
  emptyLabel?: string;
}) {
  return (
    <div className={heightClass[height]}>
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="activity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f55f3" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#4f55f3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              name="Activity"
              stroke="#4f55f3"
              fill="url(#activity)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
          {emptyLabel}
        </div>
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
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              dataKey="students"
              name="Students"
              fill="#4f55f3"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
            <Bar
              dataKey="interviewers"
              name="Interviewers"
              fill="#2e83fb"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
          No user registrations in this period.
        </div>
      )}
    </div>
  );
}

export function LanguageBarChart({
  data = [],
  height = "sm",
}: {
  data?: ChartPoint[];
  height?: ChartHeight;
}) {
  return (
    <div className={heightClass[height]}>
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip content={<ChartTooltip />} />
            <Bar
              dataKey="value"
              name="Submissions"
              fill="#436df7"
              radius={[0, 4, 4, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground px-4 text-center">
          No coding submissions yet.
        </div>
      )}
    </div>
  );
}

export function SecurityDonut({ segments = [] }: { segments?: SecuritySegment[] }) {
  return (
    <div className="space-y-3.5 py-1">
      {segments.length ? (
        segments.map((segment) => (
          <div key={segment.label}>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-foreground">{segment.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {segment.value}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full transition-[width] duration-300"
                style={{ width: `${segment.value}%`, background: segment.color }}
              />
            </div>
          </div>
        ))
      ) : (
        <div className="text-sm text-muted-foreground py-8 text-center">
          No active sessions to summarize.
        </div>
      )}
    </div>
  );
}
