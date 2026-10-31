"use client";

import type { ProctoringAnalysis } from "@/lib/proctoring/analyze";
import {
  buildProctoringReviewView,
  readableEventLabel,
  reviewCategoryForEvent,
  reviewCategoryLabel,
  timelineDetail,
} from "@/lib/proctoring/review";
import { cn } from "@/lib/utils";

function riskClass(level: string) {
  if (level === "CRITICAL" || level === "HIGH") return "text-danger bg-danger-soft";
  if (level === "MEDIUM") return "text-amber-800 bg-amber-500/15";
  return "text-success bg-success-soft";
}

const TIMELINE_LIMIT = 200;

export function AdminProctoringAnalysisReport({
  analysis,
}: {
  analysis: ProctoringAnalysis;
}) {
  const view = buildProctoringReviewView(analysis);
  const reviewTimeline = analysis.timeline.filter(
    (item) =>
      !["FACE_DETECTED", "RECORDING_STARTED", "RECORDING_STOPPED"].includes(
        item.eventType,
      ),
  );
  const visibleTimeline = reviewTimeline.slice(-TIMELINE_LIMIT);
  const hidden = reviewTimeline.length - visibleTimeline.length;

  return (
    <div className="card-soft p-5 mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="font-display font-bold">Proctoring review</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Decision-support signals only. This does not confirm misconduct or
            change a result.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-display font-bold">
            {view.riskScore}/100
          </div>
          <span
            className={cn(
              "inline-flex text-xs font-semibold uppercase px-2.5 py-1 rounded-lg mt-1",
              riskClass(view.riskLevel),
            )}
          >
            {view.riskLevel}
          </span>
          <p className="text-xs text-muted-foreground mt-1">
            {view.recommendation}
          </p>
        </div>
      </div>

      {view.riskScore === 0 ? (
        <p className="text-sm text-muted-foreground mb-4">
          No significant proctoring risk detected.
        </p>
      ) : null}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <Stat label="Risk score" value={`${view.riskScore}/100`} />
        <Stat label="Risk level" value={view.riskLevel} />
        <Stat label="Raw events" value={String(view.rawEventCount)} />
        <Stat
          label="Derived incidents"
          value={String(view.derivedIncidentCount)}
        />
      </div>

      {view.categories.length === 0 ? (
        <p className="text-sm text-muted-foreground mb-5">
          No proctoring incidents recorded.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
          {view.categories.map((category) => (
            <div
              key={category.id}
              className="rounded-xl border border-border px-3 py-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{category.label}</span>
                <span className="text-xs font-semibold text-primary">
                  +{category.points}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {category.rawEvents} raw event
                {category.rawEvents === 1 ? "" : "s"}
              </p>
              {category.note ? (
                <p className="text-[11px] text-muted-foreground mt-1">
                  {category.note}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {view.corroboratedIncidents > 0 ? (
        <div className="rounded-xl border border-border px-3 py-2.5 mb-5">
          <p className="text-sm font-semibold">
            Corroborated attention-away incident
            {view.corroboratedIncidents === 1 ? "" : "s"}:{" "}
            {view.corroboratedIncidents}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Head + eye in the same window are one incident. Gaze supports the
            head signal and is not scored again. Raw events stay in the
            timeline.
          </p>
        </div>
      ) : null}

      {view.windowAdjustment > 0 ? (
        <p className="text-xs text-muted-foreground mb-5">
          Review-window adjustment: +{view.windowAdjustment}. The score above
          is the canonical risk score.
        </p>
      ) : null}

      <div className="rounded-xl border border-border bg-muted/20 p-4 mb-5">
        <h4 className="text-sm font-semibold mb-2">Review summary</h4>
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

      {analysis.riskFactors.length > 0 ? (
        <>
          <h4 className="text-sm font-semibold mb-3">Evidence breakdown</h4>
          <div className="grid sm:grid-cols-2 gap-3 mb-5">
            {analysis.riskFactors.map((factor) => (
              <div
                key={factor.id}
                className="rounded-xl border border-border px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">
                    {factor.id === "HEAD_EYE_CORROBORATED"
                      ? "Corroborated attention-away · Head + eye"
                      : factor.label}
                  </span>
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
      ) : null}

      <h4 className="text-sm font-semibold mb-3">Raw event timeline</h4>
      {visibleTimeline.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No proctoring events recorded.
        </p>
      ) : (
        <>
          {hidden > 0 ? (
            <p className="text-xs text-muted-foreground mb-2">
              Showing the latest {TIMELINE_LIMIT} of {reviewTimeline.length}{" "}
              events.
            </p>
          ) : null}
          <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {visibleTimeline.map((item) => {
              const category = reviewCategoryForEvent(item.eventType);
              const detail = timelineDetail(item);
              return (
                <li
                  key={item.id}
                  className="rounded-xl border border-border px-3 py-2.5 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {readableEventLabel(item.eventType)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(item.timestamp).toLocaleString()}
                      {category
                        ? ` · ${reviewCategoryLabel(category)}`
                        : ""}
                      {item.recordingOffsetLabel
                        ? ` · Recording ${item.recordingOffsetLabel}`
                        : ""}
                    </p>
                    {detail ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {detail}
                      </p>
                    ) : null}
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
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="font-semibold mt-0.5">{value}</div>
    </div>
  );
}
