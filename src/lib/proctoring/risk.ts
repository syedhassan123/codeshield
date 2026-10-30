import {
  countEvidenceByType,
  INFO_EVENT_TYPES,
  labelForEvent,
} from "@/lib/proctoring/evidence";
import type {
  ProctoringCorrelationCluster,
  ProctoringEvidenceItem,
  ProctoringRiskFactor,
  ProctoringRiskLevel,
} from "@/lib/proctoring/types";

/** Per-event base points — documented, explainable weights. */
const EVENT_POINTS: Record<string, number> = {
  MULTIPLE_FACES_DETECTED: 18,
  NO_FACE_DETECTED: 8,
  PROLONGED_LOOKING_AWAY: 10,
  REPEATED_LOOKING_AWAY: 12,
  HEAD_LOOKING_LEFT: 4,
  HEAD_LOOKING_RIGHT: 4,
  HEAD_LOOKING_UP: 4,
  HEAD_LOOKING_DOWN: 4,
  TAB_SWITCH: 6,
  WINDOW_BLUR: 4,
  FULLSCREEN_EXIT: 8,
  COPY_ATTEMPT: 5,
  PASTE_ATTEMPT: 7,
  CUT_ATTEMPT: 5,
  CONTEXT_MENU_ATTEMPT: 3,
  CAMERA_PERMISSION_DENIED: 6,
  CAMERA_UNAVAILABLE: 5,
  CAMERA_DISCONNECTED: 6,
  RECORDING_UPLOAD_FAILED: 4,
};

const DURATION_BONUS_MS = 8000;
const DURATION_BONUS_POINTS = 3;
const CORRELATION_BONUS_POINTS = 8;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const HIGH_CONFIDENCE_MULTIPLIER = 1.15;

export function riskLevelFromScore(score: number): ProctoringRiskLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MEDIUM";
  return "LOW";
}

function pointsForItem(item: ProctoringEvidenceItem) {
  if (INFO_EVENT_TYPES.has(item.eventType)) return 0;
  const base = EVENT_POINTS[item.eventType] ?? 2;
  let points = base;
  if (item.durationMs != null && item.durationMs >= DURATION_BONUS_MS) {
    points += DURATION_BONUS_POINTS;
  }
  if (
    item.confidence != null &&
    item.confidence >= HIGH_CONFIDENCE_THRESHOLD
  ) {
    points = Math.round(points * HIGH_CONFIDENCE_MULTIPLIER);
  }
  return points;
}

export function buildRiskFactors(
  timeline: ProctoringEvidenceItem[],
): ProctoringRiskFactor[] {
  const counts = countEvidenceByType(timeline);
  const factors: ProctoringRiskFactor[] = [];

  for (const [eventType, count] of Object.entries(counts)) {
    const sample = timeline.find((item) => item.eventType === eventType);
    const perEvent = sample ? pointsForItem(sample) : EVENT_POINTS[eventType] ?? 2;
    const points = perEvent * count;
    factors.push({
      id: eventType,
      label: labelForEvent(eventType),
      count,
      points,
      detail: `${count} occurrence${count === 1 ? "" : "s"} · ${points} risk points`,
    });
  }

  return factors.sort((a, b) => b.points - a.points);
}

export function calculateRiskScore(
  timeline: ProctoringEvidenceItem[],
  correlations: ProctoringCorrelationCluster[],
) {
  let score = 0;
  for (const item of timeline) {
    score += pointsForItem(item);
  }

  const elevatedClusters = correlations.filter(
    (cluster) => cluster.reviewPriority === "elevated",
  ).length;
  const normalClusters = correlations.length - elevatedClusters;
  score += elevatedClusters * CORRELATION_BONUS_POINTS * 1.5;
  score += normalClusters * CORRELATION_BONUS_POINTS;

  return Math.min(100, Math.round(score));
}

export function averageVisionConfidence(timeline: ProctoringEvidenceItem[]) {
  const vision = timeline.filter(
    (item) => item.category === "vision" && item.confidence != null,
  );
  if (!vision.length) return null;
  const sum = vision.reduce((acc, item) => acc + (item.confidence ?? 0), 0);
  return Math.round((sum / vision.length) * 100) / 100;
}
