import type {
  SecurityEventType,
  SecurityRiskLevel,
  SecuritySeverity,
} from "@/types/exam-security";
import {
  LEAVE_SECURITY_EVENT_TYPES,
  SECURITY_VIOLATION_EVENT_TYPES,
} from "@/types/exam-security";

/** Deterministic severity per event type (not an AI cheating score). */
export function severityForEventType(
  eventType: SecurityEventType,
): SecuritySeverity {
  switch (eventType) {
    case "TAB_SWITCH":
    case "WINDOW_BLUR":
    case "FULLSCREEN_EXIT":
    case "CAMERA_PERMISSION_DENIED":
    case "CAMERA_UNAVAILABLE":
    case "CAMERA_DISCONNECTED":
      return "MEDIUM";
    case "RECORDING_UPLOAD_FAILED":
      return "LOW";
    case "CAMERA_RECONNECTED":
    case "RECORDING_STARTED":
    case "RECORDING_STOPPED":
    case "FACE_DETECTED":
    case "FACE_DETECTION_UNAVAILABLE":
    case "HEAD_MONITORING_UNAVAILABLE":
      return "LOW";
    case "NO_FACE_DETECTED":
    case "HEAD_LOOKING_LEFT":
    case "HEAD_LOOKING_RIGHT":
    case "HEAD_LOOKING_UP":
    case "HEAD_LOOKING_DOWN":
      return "MEDIUM";
    case "MULTIPLE_FACES_DETECTED":
    case "PROLONGED_LOOKING_AWAY":
    case "REPEATED_LOOKING_AWAY":
      return "HIGH";
    case "COPY_ATTEMPT":
    case "PASTE_ATTEMPT":
    case "CUT_ATTEMPT":
    case "CONTEXT_MENU_ATTEMPT":
    default:
      return "LOW";
  }
}

/**
 * Security Risk Level from total recorded *violation* events.
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

export function isSecurityViolationEvent(eventType: string) {
  return (SECURITY_VIOLATION_EVENT_TYPES as readonly string[]).includes(
    eventType,
  );
}

export type SecurityEventCounts = {
  TAB_SWITCH: number;
  WINDOW_BLUR: number;
  COPY_ATTEMPT: number;
  PASTE_ATTEMPT: number;
  CUT_ATTEMPT: number;
  FULLSCREEN_EXIT: number;
  CONTEXT_MENU_ATTEMPT: number;
  CAMERA_PERMISSION_DENIED: number;
  CAMERA_UNAVAILABLE: number;
  CAMERA_DISCONNECTED: number;
  CAMERA_RECONNECTED: number;
  RECORDING_STARTED: number;
  RECORDING_STOPPED: number;
  RECORDING_UPLOAD_FAILED: number;
  FACE_DETECTED: number;
  NO_FACE_DETECTED: number;
  MULTIPLE_FACES_DETECTED: number;
  FACE_DETECTION_UNAVAILABLE: number;
  HEAD_LOOKING_LEFT: number;
  HEAD_LOOKING_RIGHT: number;
  HEAD_LOOKING_UP: number;
  HEAD_LOOKING_DOWN: number;
  PROLONGED_LOOKING_AWAY: number;
  REPEATED_LOOKING_AWAY: number;
  HEAD_MONITORING_UNAVAILABLE: number;
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
    CAMERA_PERMISSION_DENIED: 0,
    CAMERA_UNAVAILABLE: 0,
    CAMERA_DISCONNECTED: 0,
    CAMERA_RECONNECTED: 0,
    RECORDING_STARTED: 0,
    RECORDING_STOPPED: 0,
    RECORDING_UPLOAD_FAILED: 0,
    FACE_DETECTED: 0,
    NO_FACE_DETECTED: 0,
    MULTIPLE_FACES_DETECTED: 0,
    FACE_DETECTION_UNAVAILABLE: 0,
    HEAD_LOOKING_LEFT: 0,
    HEAD_LOOKING_RIGHT: 0,
    HEAD_LOOKING_UP: 0,
    HEAD_LOOKING_DOWN: 0,
    PROLONGED_LOOKING_AWAY: 0,
    REPEATED_LOOKING_AWAY: 0,
    HEAD_MONITORING_UNAVAILABLE: 0,
  };

  for (const event of events) {
    const key = event.eventType as keyof SecurityEventCounts;
    if (key in counts) counts[key] += 1;
  }

  const totalViolations = events.filter((e) =>
    isSecurityViolationEvent(e.eventType),
  ).length;

  return {
    counts,
    totalViolations,
    riskLevel: securityRiskLevelFromTotal(totalViolations),
  };
}

/** Client + server leave-event dedup window (ms). */
export const SECURITY_LEAVE_DEDUP_MS = 2000;
/** Face observation dedup window (ms). */
export const FACE_EVENT_DEDUP_MS = 5000;
/** Head observation dedup window (ms). */
export const HEAD_EVENT_DEDUP_MS = 5000;
/** Clipboard keydown + clipboard-event dedup window (ms). */
export const SECURITY_CLIPBOARD_DEDUP_MS = 500;

export function isFaceObservationEvent(eventType: SecurityEventType) {
  return (
    eventType === "NO_FACE_DETECTED" || eventType === "MULTIPLE_FACES_DETECTED"
  );
}

export function isHeadObservationEvent(eventType: SecurityEventType) {
  return (
    eventType === "HEAD_LOOKING_LEFT" ||
    eventType === "HEAD_LOOKING_RIGHT" ||
    eventType === "HEAD_LOOKING_UP" ||
    eventType === "HEAD_LOOKING_DOWN" ||
    eventType === "PROLONGED_LOOKING_AWAY" ||
    eventType === "REPEATED_LOOKING_AWAY"
  );
}
