import { formatClockTime } from "@/lib/admin/format";
import type { InterviewStatus } from "@/types/interview";

/** Display labels preserve mock UI semantics while DB stores normalized statuses. */
export function formatInterviewStatus(status: InterviewStatus): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "in_progress":
      return "Live";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

/** Matches legacy mock format: `2026-06-09 · 14:30` using server locale. */
export function formatInterviewDateTime(date: Date): string {
  const datePart = date.toLocaleDateString("en-CA");
  const timePart = formatClockTime(date);
  return `${datePart} · ${timePart}`;
}

export function formatInterviewDate(date: Date): string {
  return date.toLocaleDateString("en-CA");
}
