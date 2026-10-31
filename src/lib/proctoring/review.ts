import { INFO_EVENT_TYPES, labelForEvent } from "@/lib/proctoring/evidence";
import { correlateHeadEyeAttention } from "@/lib/proctoring/risk";
import type {
  ProctoringAnalysis,
  ProctoringEvidenceItem,
  ProctoringRiskLevel,
} from "@/lib/proctoring/types";

export const REVIEW_CATEGORIES = [
  "face",
  "head",
  "eye",
  "browser",
  "camera",
  "technical",
] as const;

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number];

const CATEGORY_LABEL: Record<ReviewCategory, string> = {
  face: "Face",
  head: "Attention / head",
  eye: "Eye gaze",
  browser: "Browser",
  camera: "Camera",
  technical: "Recording / technical",
};

const EVENT_CATEGORY: Record<string, ReviewCategory> = {
  NO_FACE_DETECTED: "face",
  MULTIPLE_FACES_DETECTED: "face",
  FACE_DETECTION_UNAVAILABLE: "face",
  FACE_DETECTED: "face",
  HEAD_LOOKING_LEFT: "head",
  HEAD_LOOKING_RIGHT: "head",
  HEAD_LOOKING_UP: "head",
  HEAD_LOOKING_DOWN: "head",
  PROLONGED_LOOKING_AWAY: "head",
  REPEATED_LOOKING_AWAY: "head",
  HEAD_MONITORING_UNAVAILABLE: "head",
  HEAD_EYE_CORROBORATED: "head",
  EYE_GAZE_AWAY: "eye",
  EYE_GAZE_AWAY_PROLONGED: "eye",
  TAB_SWITCH: "browser",
  WINDOW_BLUR: "browser",
  FULLSCREEN_EXIT: "browser",
  COPY_ATTEMPT: "browser",
  PASTE_ATTEMPT: "browser",
  CUT_ATTEMPT: "browser",
  CONTEXT_MENU_ATTEMPT: "browser",
  CAMERA_PERMISSION_DENIED: "camera",
  CAMERA_UNAVAILABLE: "camera",
  CAMERA_DISCONNECTED: "camera",
  CAMERA_RECONNECTED: "camera",
  RECORDING_STARTED: "technical",
  RECORDING_STOPPED: "technical",
  RECORDING_UPLOAD_FAILED: "technical",
};

export function reviewCategoryForEvent(eventType: string): ReviewCategory | null {
  return EVENT_CATEGORY[eventType] ?? null;
}

export function reviewCategoryLabel(category: ReviewCategory) {
  return CATEGORY_LABEL[category];
}

/** Highest contribution points. Ties keep REVIEW_CATEGORIES order. */
export function primaryReviewCategory(
  categories: Array<{ id: ReviewCategory; points: number }>,
): ReviewCategory | null {
  let best: ReviewCategory | null = null;
  let bestPoints = 0;
  for (const id of REVIEW_CATEGORIES) {
    const points = categories.find((category) => category.id === id)?.points ?? 0;
    if (points <= 0) continue;
    if (best == null || points > bestPoints) {
      best = id;
      bestPoints = points;
    }
  }
  return best;
}

export function readableEventLabel(eventType: string) {
  if (!eventType || !/^[A-Z0-9_]+$/.test(eventType)) return "Security event";
  return labelForEvent(eventType);
}

export function reviewRecommendation(level: ProctoringRiskLevel) {
  switch (level) {
    case "CRITICAL":
      return "Priority review recommended";
    case "HIGH":
      return "Review recommended";
    case "MEDIUM":
      return "Review if needed";
    default:
      return "No immediate review needed";
  }
}

export function timelineDetail(item: ProctoringEvidenceItem) {
  const parts: string[] = [];
  const direction = item.metadata.direction;
  if (typeof direction === "string" && direction) {
    const pretty = direction.charAt(0) + direction.slice(1).toLowerCase();
    parts.push(`Direction: ${pretty}`);
  }
  if (item.durationMs != null) {
    parts.push(`Duration: ${Math.round(item.durationMs / 1000)}s`);
  }
  if (
    item.eventType.startsWith("EYE_GAZE_") &&
    item.confidence != null
  ) {
    parts.push(`Confidence: ${item.confidence.toFixed(2)}`);
  }
  if (typeof item.metadata.faceCount === "number") {
    parts.push(`Faces: ${item.metadata.faceCount}`);
  }
  if (typeof item.metadata.reason === "string" && item.metadata.reason) {
    parts.push(item.metadata.reason.replaceAll("_", " "));
  }
  return parts.join(" · ");
}

export type ReviewCategorySummary = {
  id: ReviewCategory;
  label: string;
  rawEvents: number;
  points: number;
  note?: string;
};

export type ProctoringReviewView = {
  riskScore: number;
  riskLevel: ProctoringRiskLevel;
  recommendation: string;
  rawEventCount: number;
  derivedIncidentCount: number;
  corroboratedIncidents: number;
  categories: ReviewCategorySummary[];
  topCategory: string | null;
  topCategoryId: ReviewCategory | null;
  windowAdjustment: number;
};

export function buildProctoringReviewView(
  analysis: ProctoringAnalysis,
): ProctoringReviewView {
  const correlation = correlateHeadEyeAttention(analysis.timeline);
  const rawEvents = analysis.timeline.filter(
    (item) => !INFO_EVENT_TYPES.has(item.eventType),
  );
  const outsideFold = rawEvents.filter(
    (item) => !correlation.foldedEventIds.has(item.id),
  ).length;
  const derivedIncidentCount = outsideFold + correlation.corroborationCount;

  const pointsByCategory = new Map<ReviewCategory, number>();
  const countsByCategory = new Map<ReviewCategory, number>();

  for (const item of rawEvents) {
    const category = reviewCategoryForEvent(item.eventType);
    if (!category) continue;
    countsByCategory.set(category, (countsByCategory.get(category) ?? 0) + 1);
  }

  for (const factor of analysis.riskFactors) {
    const category = reviewCategoryForEvent(factor.id);
    if (!category) continue;
    pointsByCategory.set(
      category,
      (pointsByCategory.get(category) ?? 0) + factor.points,
    );
    if (!countsByCategory.has(category) && factor.count > 0) {
      countsByCategory.set(category, factor.count);
    }
  }

  const categories: ReviewCategorySummary[] = REVIEW_CATEGORIES.flatMap(
    (id) => {
      const raw = countsByCategory.get(id) ?? 0;
      const points = pointsByCategory.get(id) ?? 0;
      if (raw === 0 && points === 0) return [];
      return [
        {
          id,
          label: CATEGORY_LABEL[id],
          rawEvents: raw,
          points,
          note:
            id === "eye"
              ? "Supporting signal. Real webcam calibration is still pending."
              : id === "technical"
                ? "Technical status. Not treated as misconduct."
                : undefined,
        },
      ];
    },
  );

  const topId = primaryReviewCategory(categories);
  const factorPoints = analysis.riskFactors.reduce(
    (sum, factor) => sum + factor.points,
    0,
  );

  return {
    riskScore: analysis.riskScore,
    riskLevel: analysis.riskLevel,
    recommendation: reviewRecommendation(analysis.riskLevel),
    rawEventCount: rawEvents.length,
    derivedIncidentCount,
    corroboratedIncidents: correlation.corroborationCount,
    categories,
    topCategory: topId ? reviewCategoryLabel(topId) : null,
    topCategoryId: topId,
    windowAdjustment: Math.max(0, analysis.riskScore - factorPoints),
  };
}
