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
  /** Conservative until real webcam calibration. */
  EYE_GAZE_AWAY: 2,
  EYE_GAZE_AWAY_PROLONGED: 4,
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
};

const DURATION_BONUS_MS = 8000;
const DURATION_BONUS_POINTS = 3;
const CORRELATION_BONUS_POINTS = 8;
const HIGH_CONFIDENCE_THRESHOLD = 0.85;
const HIGH_CONFIDENCE_MULTIPLIER = 1.15;

/**
 * Head and eye events inside this window are one attention episode.
 * Gaze corroborates the head signal; it is not a second full penalty.
 */
export const ATTENTION_CORRELATION_WINDOW_MS = 20_000;

/** Added once per correlated head+eye window. Not multiplied per event. */
const HEAD_EYE_CORROBORATION_POINTS = 3;

const HEAD_ATTENTION_EVENTS = new Set([
  "HEAD_LOOKING_LEFT",
  "HEAD_LOOKING_RIGHT",
  "HEAD_LOOKING_UP",
  "HEAD_LOOKING_DOWN",
  "PROLONGED_LOOKING_AWAY",
]);

const EYE_ATTENTION_EVENTS = new Set([
  "EYE_GAZE_AWAY",
  "EYE_GAZE_AWAY_PROLONGED",
]);

export type AttentionCorrelation = {
  /** Eye events whose points are folded into the head episode. */
  suppressedEyeIds: Set<string>;
  /** Head and eye events that belong to one corroborated window. */
  foldedEventIds: Set<string>;
  /** One bonus per window that contains both a head and an eye signal. */
  corroborationCount: number;
};

/**
 * Group head + eye events that fall in the same sustained window.
 * Raw events are not removed. Separate episodes (gap > window) stay separate.
 * Browser events are never grouped into this attention incident.
 */
export function correlateHeadEyeAttention(
  timeline: ProctoringEvidenceItem[],
): AttentionCorrelation {
  const attention = timeline
    .filter(
      (item) =>
        HEAD_ATTENTION_EVENTS.has(item.eventType) ||
        EYE_ATTENTION_EVENTS.has(item.eventType),
    )
    .slice()
    .sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

  const suppressedEyeIds = new Set<string>();
  const foldedEventIds = new Set<string>();
  let corroborationCount = 0;
  let i = 0;

  while (i < attention.length) {
    const start = new Date(attention[i].timestamp).getTime();
    const bucket = [attention[i]];
    let j = i + 1;
    while (j < attention.length) {
      const ts = new Date(attention[j].timestamp).getTime();
      if (ts - start > ATTENTION_CORRELATION_WINDOW_MS) break;
      bucket.push(attention[j]);
      j += 1;
    }

    const hasHead = bucket.some((item) =>
      HEAD_ATTENTION_EVENTS.has(item.eventType),
    );
    const hasEye = bucket.some((item) =>
      EYE_ATTENTION_EVENTS.has(item.eventType),
    );
    const headDirs = bucket
      .filter((item) => HEAD_ATTENTION_EVENTS.has(item.eventType))
      .map((item) => item.metadata.direction)
      .filter((value): value is string => typeof value === "string");
    const eyeDirs = bucket
      .filter((item) => EYE_ATTENTION_EVENTS.has(item.eventType))
      .map((item) => item.metadata.direction)
      .filter((value): value is string => typeof value === "string");
    const directionsAgree =
      headDirs.length === 0 ||
      eyeDirs.length === 0 ||
      headDirs.some((direction) => eyeDirs.includes(direction));
    if (hasHead && hasEye && directionsAgree) {
      corroborationCount += 1;
      for (const item of bucket) {
        foldedEventIds.add(item.id);
        if (EYE_ATTENTION_EVENTS.has(item.eventType)) {
          suppressedEyeIds.add(item.id);
        }
      }
    }
    i = j;
  }

  return { suppressedEyeIds, foldedEventIds, corroborationCount };
}

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
  // Gaze confidence is uncalibrated. Do not amplify eye-only points.
  if (
    !EYE_ATTENTION_EVENTS.has(item.eventType) &&
    item.confidence != null &&
    item.confidence >= HIGH_CONFIDENCE_THRESHOLD
  ) {
    points = Math.round(points * HIGH_CONFIDENCE_MULTIPLIER);
  }
  return points;
}

function scoredPoints(
  item: ProctoringEvidenceItem,
  suppressedEyeIds: Set<string>,
) {
  if (suppressedEyeIds.has(item.id)) return 0;
  return pointsForItem(item);
}

export function buildRiskFactors(
  timeline: ProctoringEvidenceItem[],
): ProctoringRiskFactor[] {
  const counts = countEvidenceByType(timeline);
  const { suppressedEyeIds, corroborationCount } =
    correlateHeadEyeAttention(timeline);
  const factors: ProctoringRiskFactor[] = [];

  for (const [eventType, count] of Object.entries(counts)) {
    const samples = timeline.filter((item) => item.eventType === eventType);
    const points = samples.reduce(
      (sum, item) => sum + scoredPoints(item, suppressedEyeIds),
      0,
    );
    const suppressed = samples.filter((item) =>
      suppressedEyeIds.has(item.id),
    ).length;
    const detail =
      suppressed > 0
        ? `${count} occurrence${count === 1 ? "" : "s"} · ${suppressed} corroborated with head pose (not double-counted) · ${points} risk points`
        : `${count} occurrence${count === 1 ? "" : "s"} · ${points} risk points`;
    factors.push({
      id: eventType,
      label: labelForEvent(eventType),
      count,
      points,
      detail,
    });
  }

  if (corroborationCount > 0) {
    const points = corroborationCount * HEAD_EYE_CORROBORATION_POINTS;
    factors.push({
      id: "HEAD_EYE_CORROBORATED",
      label: "Corroborated attention-away",
      count: corroborationCount,
      points,
      detail: `${corroborationCount} attention window${corroborationCount === 1 ? "" : "s"} where gaze supported head pose · ${points} risk points`,
    });
  }

  return factors.sort((a, b) => b.points - a.points);
}

export function calculateRiskScore(
  timeline: ProctoringEvidenceItem[],
  correlations: ProctoringCorrelationCluster[],
) {
  const { suppressedEyeIds, corroborationCount } =
    correlateHeadEyeAttention(timeline);
  let score = 0;
  for (const item of timeline) {
    score += scoredPoints(item, suppressedEyeIds);
  }
  score += corroborationCount * HEAD_EYE_CORROBORATION_POINTS;

  const elevatedClusters = correlations.filter(
    (cluster) => cluster.reviewPriority === "elevated",
  ).length;
  const normalClusters = correlations.length - elevatedClusters;
  score += elevatedClusters * CORRELATION_BONUS_POINTS * 1.5;
  score += normalClusters * CORRELATION_BONUS_POINTS;

  return Math.min(100, Math.max(0, Math.round(score)));
}

export function averageVisionConfidence(timeline: ProctoringEvidenceItem[]) {
  const vision = timeline.filter(
    (item) => item.category === "vision" && item.confidence != null,
  );
  if (!vision.length) return null;
  const sum = vision.reduce((acc, item) => acc + (item.confidence ?? 0), 0);
  return Math.round((sum / vision.length) * 100) / 100;
}
