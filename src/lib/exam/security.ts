import type {
  SecurityEventType,
  SecurityRiskLevel,
  SecuritySeverity,
} from "@/types/exam-security";
import { LEAVE_SECURITY_EVENT_TYPES } from "@/types/exam-security";

/** Deterministic severity per event type (not an AI cheating score). */
export function severityForEventType(
  eventType: SecurityEventType,
): SecuritySeverity {
  switch (eventType) {
    case "TAB_SWITCH":
    case "WINDOW_BLUR":
    case "FULLSCREEN_EXIT":
      return "MEDIUM";
    case "COPY_ATTEMPT":
    case "PASTE_ATTEMPT":
    case "CUT_ATTEMPT":
    case "CONTEXT_MENU_ATTEMPT":
    default:
      return "LOW";
  }
}

/**
 * Security Risk Level from total recorded events.
 * Centralized thresholds — change here only.
 * This is NOT a confirmed-cheating score.
 */
export function securityRiskLevelFromTotal(total: number): SecurityRiskLevel {
  if (total >= 6) return "HIGH";
  if (total >= 3) return "MEDIUM";
  return "LOW";
}

export function isLeaveSecurityEvent(eventType: SecurityEventType) {
  return (LEAVE_SECURITY_EVENT_TYPES as readonly string[]).includes(eventType);
}

export type SecurityEventCounts = {
  TAB_SWITCH: number;
  WINDOW_BLUR: number;
  COPY_ATTEMPT: number;
  PASTE_ATTEMPT: number;
  CUT_ATTEMPT: number;
  FULLSCREEN_EXIT: number;
  CONTEXT_MENU_ATTEMPT: number;
};

export type SecuritySummary = {
  counts: SecurityEventCounts;
  totalViolations: number;
  riskLevel: SecurityRiskLevel;
};

export function buildSecuritySummary(
  events: Array<{ eventType: string }>,
): SecuritySummary {
  const counts: SecurityEventCounts = {
    TAB_SWITCH: 0,
    WINDOW_BLUR: 0,
    COPY_ATTEMPT: 0,
    PASTE_ATTEMPT: 0,
    CUT_ATTEMPT: 0,
    FULLSCREEN_EXIT: 0,
    CONTEXT_MENU_ATTEMPT: 0,
  };

  for (const event of events) {
    const key = event.eventType as keyof SecurityEventCounts;
    if (key in counts) counts[key] += 1;
  }

  const totalViolations = Object.values(counts).reduce((a, b) => a + b, 0);
  return {
    counts,
    totalViolations,
    riskLevel: securityRiskLevelFromTotal(totalViolations),
  };
}

/** Client + server leave-event dedup window (ms). */
export const SECURITY_LEAVE_DEDUP_MS = 2000;
/** Clipboard keydown + clipboard-event dedup window (ms). */
export const SECURITY_CLIPBOARD_DEDUP_MS = 500;
