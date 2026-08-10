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

const weekData = [
  { name: "Mon", value: 40 },
  { name: "Tue", value: 65 },
  { name: "Wed", value: 50 },
  { name: "Thu", value: 90 },
  { name: "Fri", value: 120 },
  { name: "Sat", value: 70 },
  { name: "Sun", value: 55 },
];

const monthData = [
  { name: "Jan", students: 120, interviewers: 20 },
  { name: "Feb", students: 180, interviewers: 28 },
  { name: "Mar", students: 240, interviewers: 35 },
  { name: "Apr", students: 300, interviewers: 40 },
  { name: "May", students: 360, interviewers: 48 },
  { name: "Jun", students: 420, interviewers: 55 },
  { name: "Jul", students: 480, interviewers: 62 },
  { name: "Aug", students: 520, interviewers: 70 },
];

const langData = [
  { name: "Python", value: 58 },
  { name: "JavaScript", value: 42 },
  { name: "Java", value: 35 },
  { name: "C++", value: 28 },
];

export function ActivityAreaChart() {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={weekData}>
          <defs>
            <linearGradient id="activity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f55f3" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#4f55f3" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
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
    </div>
  );
}

export function GrowthBarChart() {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={monthData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="students" fill="#4f55f3" radius={[6, 6, 0, 0]} />
          <Bar dataKey="interviewers" fill="#2e83fb" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function LanguageBarChart() {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={langData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e8edf5" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Bar dataKey="value" fill="#436df7" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SecurityDonut() {
  const segments = [
    { label: "Safe", value: 78, color: "var(--success)" },
    { label: "Warnings", value: 16, color: "var(--warning)" },
    { label: "Violations", value: 6, color: "var(--danger)" },
  ];
  return (
    <div className="space-y-3">
      {segments.map((s) => (
        <div key={s.label}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold">{s.label}</span>
            <span className="text-muted-foreground">{s.value}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${s.value}%`, background: s.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
