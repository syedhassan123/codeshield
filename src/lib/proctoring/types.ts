export type ProctoringRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type EvidenceCategory =
  | "browser"
  | "vision"
  | "camera"
  | "recording"
  | "info";

export type ProctoringEvidenceItem = {
  id: string;
  category: EvidenceCategory;
  eventType: string;
  label: string;
  timestamp: string;
  /** Seconds from recording start, when recording metadata is available. */
  recordingOffsetSeconds: number | null;
  recordingOffsetLabel: string | null;
  durationMs: number | null;
  /** Detector confidence 0–1 when available; separate from risk. */
  confidence: number | null;
  severity: string;
  metadata: Record<string, unknown>;
};

export type ProctoringRiskFactor = {
  id: string;
  label: string;
  count: number;
  points: number;
  detail: string;
};

export type ProctoringCorrelationCluster = {
  startTimestamp: string;
  endTimestamp: string;
  durationSeconds: number;
  eventTypes: string[];
  categories: EvidenceCategory[];
  label: string;
  reviewPriority: "normal" | "elevated";
};

export type ProctoringReviewSummary = {
  overallRisk: ProctoringRiskLevel;
  riskScore: number;
  summary: string;
  keyEvents: string[];
  recommendedReviewPoints: string[];
  disclaimer: string;
};

export type ProctoringAnalysis = {
  riskScore: number;
  riskLevel: ProctoringRiskLevel;
  /** Average detector confidence across vision events that reported confidence. */
  averageVisionConfidence: number | null;
  evidenceCounts: Record<string, number>;
  riskFactors: ProctoringRiskFactor[];
  timeline: ProctoringEvidenceItem[];
  correlations: ProctoringCorrelationCluster[];
  summary: ProctoringReviewSummary;
};

export type ProctoringAnalyzeInput = {
  events: Array<{
    id: string;
    eventType: string;
    severity: string;
    timestamp: string;
    metadata: Record<string, unknown>;
  }>;
  attemptStartedAt: string;
  recordingStartedAt: string | null;
};
