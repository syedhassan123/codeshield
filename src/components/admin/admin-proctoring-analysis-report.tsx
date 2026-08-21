"use client";

import type { ProctoringAnalysis } from "@/lib/proctoring/analyze";
import { formatTimelineEntry } from "@/lib/proctoring/summary";
import { cn } from "@/lib/utils";

function riskClass(level: string) {
  if (level === "CRITICAL" || level === "HIGH") return "text-danger bg-danger-soft";
  if (level === "MEDIUM") return "text-amber-800 bg-amber-500/15";
  return "text-success bg-success-soft";
}

export function AdminProctoringAnalysisReport({
  analysis,
}: {
  analysis: ProctoringAnalysis;
}) {
  const reviewTimeline = analysis.timeline.filter(
    (item) =>
      !["FACE_DETECTED", "RECORDING_STARTED", "RECORDING_STOPPED"].includes(
        item.eventType,
      ),
  );

  return (
    <div className="card-soft p-5 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold">Proctoring Risk Analysis</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Explainable decision-support signals — not an automatic cheating
            determination.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-display font-bold">
            {analysis.riskScore}/100
          </div>
          <span
            className={cn(
              "inline-flex text-xs font-semibold uppercase px-2.5 py-1 rounded-lg mt-1",
              riskClass(analysis.riskLevel),
            )}
          >
            Risk: {analysis.riskLevel}
          </span>
        </div>
      </div>

      {analysis.averageVisionConfidence != null && (
        <p className="text-xs text-muted-foreground mb-4">
          Average vision detector confidence:{" "}
          {Math.round(analysis.averageVisionConfidence * 100)}% (separate from
          overall risk)
        </p>
      )}

      <div className="rounded-xl border border-border bg-muted/20 p-4 mb-5">
        <h4 className="text-sm font-semibold mb-2">Automated review summary</h4>
        <p className="text-sm text-muted-foreground">{analysis.summary.summary}</p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {analysis.summary.recommendedReviewPoints.map((point) => (
            <li key={point} className="flex gap-2">
              <span className="text-primary">•</span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted-foreground mt-3">
          {analysis.summary.disclaimer}
        </p>
      </div>

      {analysis.riskFactors.length > 0 && (
        <>
          <h4 className="text-sm font-semibold mb-3">Risk factors</h4>
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {analysis.riskFactors.map((factor) => (
              <div
                key={factor.id}
                className="rounded-xl border border-border px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{factor.label}</span>
                  <span className="text-xs font-semibold text-primary">
                    +{factor.points}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {factor.detail}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {analysis.correlations.length > 0 && (
        <>
          <h4 className="text-sm font-semibold mb-3">Correlated review windows</h4>
          <ul className="space-y-2 mb-5">
            {analysis.correlations.map((cluster) => (
              <li
                key={`${cluster.startTimestamp}-${cluster.endTimestamp}`}
                className="rounded-xl border border-border px-3 py-2.5"
              >
                <p className="text-sm font-semibold">{cluster.label}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(cluster.startTimestamp).toLocaleTimeString()} –{" "}
                  {new Date(cluster.endTimestamp).toLocaleTimeString()} ·{" "}
                  {cluster.eventTypes.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      <h4 className="text-sm font-semibold mb-3">Unified proctoring timeline</h4>
      {reviewTimeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviewable proctoring signals recorded for this attempt.
        </p>
      ) : (
        <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {reviewTimeline.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
            >
              <div>
                <p className="text-sm font-semibold">
                  {formatTimelineEntry(item)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(item.timestamp).toLocaleString()}
                  {item.recordingOffsetLabel
                    ? ` · Recording ${item.recordingOffsetLabel}`
                    : ""}
                </p>
              </div>
              <span
                className={cn(
                  "text-[11px] font-semibold uppercase px-2 py-1 rounded-md",
                  riskClass(item.severity),
                )}
              >
                {item.severity}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
