import { findTemporalCorrelations } from "@/lib/proctoring/correlation";
import {
  buildEvidenceTimeline,
  countEvidenceByType,
} from "@/lib/proctoring/evidence";
import {
  averageVisionConfidence,
  buildRiskFactors,
  calculateRiskScore,
  riskLevelFromScore,
} from "@/lib/proctoring/risk";
import { buildProctoringReviewSummary } from "@/lib/proctoring/summary";
import type {
  ProctoringAnalysis,
  ProctoringAnalyzeInput,
} from "@/lib/proctoring/types";

export function analyzeProctoringAttempt(
  input: ProctoringAnalyzeInput,
): ProctoringAnalysis {
  const timeline = buildEvidenceTimeline(input);
  const correlations = findTemporalCorrelations(timeline);
  const riskFactors = buildRiskFactors(timeline);
  const riskScore = calculateRiskScore(timeline, correlations);
  const riskLevel = riskLevelFromScore(riskScore);
  const evidenceCounts = countEvidenceByType(timeline);
  const avgConfidence = averageVisionConfidence(timeline);

  const attemptDurationMinutes = input.attemptStartedAt
    ? Math.max(
        0,
        Math.round(
          ((timeline.at(-1)
            ? new Date(timeline.at(-1)!.timestamp).getTime()
            : Date.now()) -
            new Date(input.attemptStartedAt).getTime()) /
            60000,
        ),
      )
    : null;

  const summary = buildProctoringReviewSummary({
    riskScore,
    riskLevel,
    riskFactors,
    correlations,
    attemptDurationMinutes,
  });

  return {
    riskScore,
    riskLevel,
    averageVisionConfidence: avgConfidence,
    evidenceCounts,
    riskFactors,
    timeline,
    correlations,
    summary,
  };
}

export type { ProctoringAnalysis, ProctoringAnalyzeInput } from "@/lib/proctoring/types";
