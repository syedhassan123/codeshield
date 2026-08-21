import { labelForEvent } from "@/lib/proctoring/evidence";
import type {
  ProctoringCorrelationCluster,
  ProctoringReviewSummary,
  ProctoringRiskFactor,
  ProctoringRiskLevel,
} from "@/lib/proctoring/types";

const DISCLAIMER =
  "Automated proctoring signals are decision-support only. They do not automatically determine cheating or change grades.";

export function buildProctoringReviewSummary(options: {
  riskScore: number;
  riskLevel: ProctoringRiskLevel;
  riskFactors: ProctoringRiskFactor[];
  correlations: ProctoringCorrelationCluster[];
  attemptDurationMinutes: number | null;
}): ProctoringReviewSummary {
  const { riskScore, riskLevel, riskFactors, correlations } = options;

  const keyEvents = riskFactors.slice(0, 5).map((factor) => {
    return `${factor.label} (${factor.count})`;
  });

  const recommendedReviewPoints: string[] = [];

  const multipleFaces = riskFactors.find(
    (factor) => factor.id === "MULTIPLE_FACES_DETECTED",
  );
  if (multipleFaces) {
    recommendedReviewPoints.push(
      "Review the recording around multiple-face detections to verify who was visible.",
    );
  }

  const tabSwitches = riskFactors.find((factor) => factor.id === "TAB_SWITCH");
  if (tabSwitches && tabSwitches.count >= 2) {
    recommendedReviewPoints.push(
      "Compare tab-switch timestamps with the recording timeline for context.",
    );
  }

  const faceAbsent = riskFactors.find(
    (factor) => factor.id === "NO_FACE_DETECTED",
  );
  if (faceAbsent) {
    recommendedReviewPoints.push(
      "Inspect periods where the candidate was not visible to the camera.",
    );
  }

  const headAway = riskFactors.filter((factor) =>
    [
      "PROLONGED_LOOKING_AWAY",
      "REPEATED_LOOKING_AWAY",
      "HEAD_LOOKING_LEFT",
      "HEAD_LOOKING_RIGHT",
      "HEAD_LOOKING_UP",
      "HEAD_LOOKING_DOWN",
    ].includes(factor.id),
  );
  if (headAway.length) {
    recommendedReviewPoints.push(
      "Review sustained or repeated head-away observations alongside question difficulty.",
    );
  }

  for (const cluster of correlations.filter(
    (item) => item.reviewPriority === "elevated",
  )) {
    recommendedReviewPoints.push(
      `Elevated review window (${new Date(cluster.startTimestamp).toLocaleTimeString()}): ${cluster.label}.`,
    );
  }

  if (!recommendedReviewPoints.length && riskLevel === "LOW") {
    recommendedReviewPoints.push(
      "No high-priority review points identified. Spot-check the recording if desired.",
    );
  }

  if (!recommendedReviewPoints.length) {
    recommendedReviewPoints.push(
      "Review the unified timeline and recording for any patterns of concern.",
    );
  }

  const summaryParts: string[] = [];
  if (riskLevel === "LOW") {
    summaryParts.push(
      "This attempt has a low automated review priority based on recorded proctoring signals.",
    );
  } else if (riskLevel === "MEDIUM") {
    summaryParts.push(
      "This attempt contains several proctoring signals that may warrant a brief admin review.",
    );
  } else {
    summaryParts.push(
      "This attempt contains multiple proctoring signals that may warrant closer admin review.",
    );
  }

  if (keyEvents.length) {
    summaryParts.push(
      `Notable signals include ${keyEvents.slice(0, 3).join(", ")}.`,
    );
  }

  if (correlations.length) {
    summaryParts.push(
      `${correlations.length} correlated time window${correlations.length === 1 ? "" : "s"} were identified where multiple signal types occurred close together.`,
    );
  }

  summaryParts.push(
    "These results are assistive evidence only and should not be treated as confirmed misconduct.",
  );

  return {
    overallRisk: riskLevel,
    riskScore,
    summary: summaryParts.join(" "),
    keyEvents,
    recommendedReviewPoints: [...new Set(recommendedReviewPoints)].slice(0, 6),
    disclaimer: DISCLAIMER,
  };
}

export function formatTimelineEntry(item: {
  label: string;
  recordingOffsetLabel: string | null;
  durationMs: number | null;
  confidence: number | null;
}) {
  const parts = [item.label];
  if (item.recordingOffsetLabel) {
    parts.unshift(item.recordingOffsetLabel);
  }
  if (item.durationMs != null) {
    parts.push(`${Math.round(item.durationMs / 1000)}s`);
  }
  if (item.confidence != null) {
    parts.push(`${Math.round(item.confidence * 100)}% conf.`);
  }
  return parts.join(" · ");
}

export function riskLevelLabel(level: ProctoringRiskLevel) {
  return level;
}

export function eventTypeToReadable(type: string) {
  return labelForEvent(type);
}
