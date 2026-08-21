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

export function ActivityAreaChart({ data = [] }: { data?: ChartPoint[] }) {
  return (
    <div className="h-56">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="activity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f55f3" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#4f55f3" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#4f55f3"
              fill="url(#activity)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          No attempt activity in the last 7 days.
        </div>
      )}
    </div>
  );
}

export function GrowthBarChart({ data = [] }: { data?: GrowthPoint[] }) {
  return (
    <div className="h-56">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="students" fill="#4f55f3" radius={[6, 6, 0, 0]} />
            <Bar dataKey="interviewers" fill="#2e83fb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          No user registrations in this period.
        </div>
      )}
    </div>
  );
}

export function LanguageBarChart({ data = [] }: { data?: ChartPoint[] }) {
  return (
    <div className="h-56">
      {data.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#436df7" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
          No coding submissions yet.
        </div>
      )}
    </div>
  );
}

export function SecurityDonut({ segments = [] }: { segments?: SecuritySegment[] }) {
  return (
    <div className="space-y-3">
      {segments.length ? (
        segments.map((segment) => (
          <div key={segment.label}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-semibold">{segment.label}</span>
              <span className="text-muted-foreground">{segment.value}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${segment.value}%`, background: segment.color }}
              />
            </div>
          </div>
        ))
      ) : (
        <div className="text-sm text-muted-foreground">
          No active sessions to summarize.
        </div>
      )}
    </div>
  );
}
