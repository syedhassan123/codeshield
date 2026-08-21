import { isSecurityViolationEvent } from "@/lib/exam/security";
import type { SecuritySeverity } from "@/types/exam-security";

export function formatEventType(eventType: string) {
  return eventType
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRelativeTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - value.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return value.toLocaleDateString();
}

export function formatClockTime(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDurationMs(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatPercent(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function severityTone(severity: SecuritySeverity) {
  switch (severity) {
    case "HIGH":
      return "danger" as const;
    case "MEDIUM":
      return "warning" as const;
    default:
      return "default" as const;
  }
}

export function riskTone(risk: "LOW" | "MEDIUM" | "HIGH") {
  switch (risk) {
    case "HIGH":
      return "danger" as const;
    case "MEDIUM":
      return "warning" as const;
    default:
      return "success" as const;
  }
}

export function escapeCsvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCsv(headers: string[], rows: unknown[][]) {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((row) => row.map(escapeCsvCell).join(",")),
  ];
  return lines.join("\r\n");
}

export function countViolations(events: Array<{ eventType: string }>) {
  return events.filter((event) => isSecurityViolationEvent(event.eventType)).length;
}
