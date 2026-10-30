import type {
  EvidenceCategory,
  ProctoringAnalyzeInput,
  ProctoringEvidenceItem,
} from "@/lib/proctoring/types";

const EVENT_LABELS: Record<string, string> = {
  TAB_SWITCH: "Tab switched",
  WINDOW_BLUR: "Window blur",
  FULLSCREEN_EXIT: "Fullscreen exited",
  COPY_ATTEMPT: "Copy attempt",
  PASTE_ATTEMPT: "Paste attempt",
  CUT_ATTEMPT: "Cut attempt",
  CONTEXT_MENU_ATTEMPT: "Context menu attempt",
  CAMERA_PERMISSION_DENIED: "Camera permission denied",
  CAMERA_UNAVAILABLE: "Camera unavailable",
  CAMERA_DISCONNECTED: "Camera disconnected",
  CAMERA_RECONNECTED: "Camera reconnected",
  RECORDING_STARTED: "Recording started",
  RECORDING_STOPPED: "Recording stopped",
  RECORDING_UPLOAD_FAILED: "Recording upload failed",
  FACE_DETECTED: "Face detected",
  NO_FACE_DETECTED: "Face absent",
  MULTIPLE_FACES_DETECTED: "Multiple faces detected",
  FACE_DETECTION_UNAVAILABLE: "Face monitoring unavailable",
  HEAD_LOOKING_LEFT: "Head turned left",
  HEAD_LOOKING_RIGHT: "Head turned right",
  HEAD_LOOKING_UP: "Head turned up",
  HEAD_LOOKING_DOWN: "Head turned down",
  PROLONGED_LOOKING_AWAY: "Prolonged looking away",
  REPEATED_LOOKING_AWAY: "Repeated looking away",
  HEAD_MONITORING_UNAVAILABLE: "Head monitoring unavailable",
};

const VISION_EVENTS = new Set([
  "FACE_DETECTED",
  "NO_FACE_DETECTED",
  "MULTIPLE_FACES_DETECTED",
  "FACE_DETECTION_UNAVAILABLE",
  "HEAD_LOOKING_LEFT",
  "HEAD_LOOKING_RIGHT",
  "HEAD_LOOKING_UP",
  "HEAD_LOOKING_DOWN",
  "PROLONGED_LOOKING_AWAY",
  "REPEATED_LOOKING_AWAY",
  "HEAD_MONITORING_UNAVAILABLE",
]);

const BROWSER_EVENTS = new Set([
  "TAB_SWITCH",
  "WINDOW_BLUR",
  "FULLSCREEN_EXIT",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "CUT_ATTEMPT",
  "CONTEXT_MENU_ATTEMPT",
]);

const CAMERA_EVENTS = new Set([
  "CAMERA_PERMISSION_DENIED",
  "CAMERA_UNAVAILABLE",
  "CAMERA_DISCONNECTED",
  "CAMERA_RECONNECTED",
]);

const RECORDING_EVENTS = new Set([
  "RECORDING_STARTED",
  "RECORDING_STOPPED",
  "RECORDING_UPLOAD_FAILED",
]);

export function formatRecordingOffset(seconds: number | null) {
  if (seconds == null || seconds < 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function recordingOffsetSeconds(
  eventTimestamp: string,
  recordingStartedAt: string | null,
) {
  if (!recordingStartedAt) return null;
  const delta = Math.round(
    (new Date(eventTimestamp).getTime() -
      new Date(recordingStartedAt).getTime()) /
      1000,
  );
  return delta >= 0 ? delta : null;
}

export function extractConfidence(metadata: Record<string, unknown>) {
  const raw =
    metadata.confidence ??
    metadata.avgConfidence ??
    metadata.detectionConfidence;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 1 ? raw / 100 : Math.min(1, Math.max(0, raw));
  }
  const durationMs =
    typeof metadata.durationMs === "number" ? metadata.durationMs : null;
  if (durationMs != null && durationMs >= 3000) {
    return Math.min(0.95, 0.7 + durationMs / 20000);
  }
  return null;
}

export function extractDurationMs(metadata: Record<string, unknown>) {
  return typeof metadata.durationMs === "number" &&
    Number.isFinite(metadata.durationMs)
    ? metadata.durationMs
    : null;
}

function categoryForEvent(eventType: string): EvidenceCategory {
  if (VISION_EVENTS.has(eventType)) return "vision";
  if (BROWSER_EVENTS.has(eventType)) return "browser";
  if (CAMERA_EVENTS.has(eventType)) return "camera";
  if (RECORDING_EVENTS.has(eventType)) return "recording";
  return "info";
}

export function labelForEvent(eventType: string) {
  return (
    EVENT_LABELS[eventType] ??
    eventType
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

/** Info/lifecycle events excluded from risk scoring but kept on timeline. */
export const INFO_EVENT_TYPES = new Set([
  "FACE_DETECTED",
  "CAMERA_RECONNECTED",
  "RECORDING_STARTED",
  "RECORDING_STOPPED",
  "FACE_DETECTION_UNAVAILABLE",
  "HEAD_MONITORING_UNAVAILABLE",
]);

export function buildEvidenceTimeline(
  input: ProctoringAnalyzeInput,
): ProctoringEvidenceItem[] {
  return input.events
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    .map((event) => {
      const offset = recordingOffsetSeconds(
        event.timestamp,
        input.recordingStartedAt,
      );
      return {
        id: event.id,
        category: categoryForEvent(event.eventType),
        eventType: event.eventType,
        label: labelForEvent(event.eventType),
        timestamp: event.timestamp,
        recordingOffsetSeconds: offset,
        recordingOffsetLabel: formatRecordingOffset(offset),
        durationMs: extractDurationMs(event.metadata),
        confidence: extractConfidence(event.metadata),
        severity: event.severity,
        metadata: event.metadata,
      };
    });
}

export function countEvidenceByType(timeline: ProctoringEvidenceItem[]) {
  const counts: Record<string, number> = {};
  for (const item of timeline) {
    if (INFO_EVENT_TYPES.has(item.eventType)) continue;
    counts[item.eventType] = (counts[item.eventType] ?? 0) + 1;
  }
  return counts;
}
