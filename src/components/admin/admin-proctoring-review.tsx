"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { listProctoringReviewQueueAction } from "@/lib/actions/grading";
import {
  REVIEW_CATEGORIES,
  reviewCategoryLabel,
  type ReviewCategory,
} from "@/lib/proctoring/review";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type QueueRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  assessmentTitle: string;
  status: string;
  completedAt: string | null;
  riskScore: number;
  riskLevel: string;
  recommendation: string;
  rawEventCount: number;
  derivedIncidentCount: number;
  hasProctoringData: boolean;
  topCategory: string | null;
  reviewStatus?: "UNREVIEWED" | "REVIEWED";
  reviewDecision?: string | null;
  reviewDecisionLabel?: string;
  reviewerName?: string | null;
};

type Overview = {
  scopeLabel: string;
  truncationNote: string;
  totalAnalyzed: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  needsReview: number;
  unreviewedHighCritical?: number;
  cleared?: number;
  flagged?: number;
  needsFollowUp?: number;
  reviewCompletionLabel?: string;
  averageRisk: number;
  averageRiskDenominator: number;
  noProctoringData: number;
  noRecordedIncidents: number;
  rawEvents: number;
  derivedIncidents: number;
  categories: Array<{ id: string; label: string; rawEvents: number; points: number }>;
  assessments: Array<{
    assessmentId: string;
    title: string;
    attempts: number;
    averageRisk: number;
    high: number;
    critical: number;
    needsReview: number;
    reviewRateLabel: string;
    topIncidentCategory: string | null;
  }>;
};

type QueuePayload = {
  overview: Overview;
  queue: QueueRow[];
  total: number;
  page: number;
  pageCount: number;
  emptyReason: "none" | "no_attempts" | "no_matches" | "in_progress";
};

export function AdminProctoringReview({
  assessmentId,
  studentId,
  status,
  search,
}: {
  assessmentId: string;
  studentId: string;
  status: string;
  search: string;
}) {
  const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
  const [risk, setRisk] = useState("needs_review");
  const [review, setReview] = useState("active");
  const [category, setCategory] = useState<"all" | ReviewCategory>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<QueuePayload | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    setError("");
    startTransition(async () => {
      const result = await listProctoringReviewQueueAction({
        windowDays,
        page,
        pageSize: 20,
        risk,
        review,
        category,
        assessmentId,
        studentId,
        status,
        search,
      });
      if (cancelled) return;
      if ("error" in result && result.error) {
        setData(null);
        setError(
          result.error === "Something went wrong."
            ? "Unable to load proctoring analytics."
            : result.error,
        );
        return;
      }
      if ("overview" in result && "queue" in result) {
        setData(result as QueuePayload);
        setError("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [windowDays, page, risk, review, category, assessmentId, studentId, status, search]);

  const overview = data?.overview;

  return (
    <section className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <h2 className="font-display font-bold text-base">Proctoring review queue</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {overview?.scopeLabel ?? "Last 30 days · submitted and expired attempts"}
            . Counts cover this window, not the grading page below.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
            value={windowDays}
            aria-label="Review window"
            onChange={(event) => {
              const next = Number(event.target.value);
              setWindowDays(next === 7 || next === 90 ? next : 30);
              setPage(1);
            }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <select
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
            value={risk}
            aria-label="Risk level"
            onChange={(event) => {
              setRisk(event.target.value);
              setPage(1);
            }}
          >
            <option value="needs_review">Needs review</option>
            <option value="all">All risk levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>
          <select
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
            value={review}
            aria-label="Review decision"
            onChange={(event) => {
              setReview(event.target.value);
              setPage(1);
            }}
          >
            <option value="active">Active queue</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="needs_follow_up">Needs follow-up</option>
            <option value="flagged">Flagged</option>
            <option value="cleared">Cleared</option>
            <option value="all">All decisions</option>
          </select>
          <select
            className="h-9 rounded-xl border border-border bg-background px-3 text-sm"
            value={category}
            aria-label="Incident category"
            onChange={(event) => {
              const next = event.target.value;
              setCategory(
                next === "all" || REVIEW_CATEGORIES.includes(next as ReviewCategory)
                  ? (next as "all" | ReviewCategory)
                  : "all",
              );
              setPage(1);
            }}
          >
            <option value="all">All categories</option>
            {REVIEW_CATEGORIES.map((id) => (
              <option key={id} value={id}>
                {reviewCategoryLabel(id)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mb-3">
        Proctoring risk is a review aid and does not automatically determine misconduct.
        Eye gaze is a supporting signal. Real webcam calibration is still pending.
      </p>

      {error && (
        <div className="mb-4 text-sm font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      {overview?.truncationNote ? (
        <p className="mb-3 text-sm text-muted-foreground">{overview.truncationNote}</p>
      ) : null}

      {overview && data?.emptyReason !== "in_progress" && (
        <>
          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <Kpi
              label="Total analyzed attempts"
              value={String(overview.totalAnalyzed)}
              detail={`Average risk ${overview.averageRisk} across ${overview.averageRiskDenominator}`}
            />
            <Kpi
              label="Needs review"
              value={String(overview.needsReview)}
              detail={`${overview.unreviewedHighCritical ?? overview.needsReview} unreviewed high or critical · reviewed ${overview.reviewCompletionLabel ?? "0/0"}`}
            />
            <Kpi
              label="Critical risk"
              value={String(overview.critical)}
              detail={`${overview.high} high · ${overview.medium} medium · ${overview.low} low`}
            />
            <Kpi
              label="No proctoring data"
              value={String(overview.noProctoringData)}
              detail={
                overview.noRecordedIncidents
                  ? `${overview.noRecordedIncidents} with events but no recorded incidents`
                  : "Not treated as safe"
              }
            />
          </div>

          <div className="grid lg:grid-cols-2 gap-3 mb-4">
            <div className="card-soft p-4">
              <h3 className="font-display font-bold text-sm mb-3">Risk distribution</h3>
              <Distribution label="Low" value={overview.low} />
              <Distribution label="Medium" value={overview.medium} />
              <Distribution label="High" value={overview.high} />
              <Distribution label="Critical" value={overview.critical} />
            </div>
            <div className="card-soft p-4">
              <h3 className="font-display font-bold text-sm mb-1">Incident categories</h3>
              <p className="text-[11px] text-muted-foreground mb-3">
                {overview.derivedIncidents} derived incidents · {overview.rawEvents} raw events.
                Raw events are not violations.
              </p>
              {overview.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">No categorized incidents in this window.</p>
              ) : (
                <ul className="space-y-2">
                  {overview.categories.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{item.label}</span>
                      <span className="text-muted-foreground text-right">
                        {item.points} pts · {item.rawEvents} raw
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {overview.totalAnalyzed > 0 &&
            overview.noProctoringData === overview.totalAnalyzed && (
              <p className="mb-4 text-sm text-muted-foreground">
                No proctoring events recorded for the selected attempts.
              </p>
            )}

          {overview.assessments.length > 0 && (
            <div className="card-soft overflow-x-auto mb-4">
              <div className="px-4 pt-4">
                <h3 className="font-display font-bold text-sm">Assessment breakdown</h3>
                <p className="text-[11px] text-muted-foreground mt-1 mb-2">
                  Average risk across attempts. Review rate is needs review / analyzed attempts.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                    <th className="text-left py-3 px-4">Assessment</th>
                    <th className="text-left py-3 px-4">Attempts</th>
                    <th className="text-left py-3 px-4">Avg risk</th>
                    <th className="text-left py-3 px-4">High/Critical</th>
                    <th className="text-left py-3 px-4">Top incident category</th>
                    <th className="text-left py-3 px-4">Review rate</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.assessments.map((row) => (
                    <tr key={row.assessmentId} className="border-b border-border last:border-0">
                      <td className="py-3 px-4 font-medium">{row.title}</td>
                      <td className="py-3 px-4">{row.attempts}</td>
                      <td className="py-3 px-4">{row.averageRisk}</td>
                      <td className="py-3 px-4">
                        {row.high}/{row.critical}
                      </td>
                      <td className="py-3 px-4">{row.topIncidentCategory ?? "None"}</td>
                      <td className="py-3 px-4">{row.reviewRateLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {overview && data?.emptyReason !== "in_progress" && (
        <p className="text-sm text-muted-foreground mb-4">
          Unreviewed high or critical {overview.unreviewedHighCritical ?? 0}. Cleared{" "}
          {overview.cleared ?? 0}. Flagged {overview.flagged ?? 0}. Needs follow-up{" "}
          {overview.needsFollowUp ?? 0}. Active queue hides cleared and flagged attempts.
        </p>
      )}

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">Student</th>
              <th className="text-left py-3 px-4">Assessment</th>
              <th className="text-left py-3 px-4">Completed</th>
              <th className="text-left py-3 px-4">Risk</th>
              <th className="text-left py-3 px-4">Review</th>
              <th className="text-left py-3 px-4">Incidents</th>
              <th className="text-left py-3 px-4">Recommendation</th>
              <th className="text-left py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {data?.queue.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4">
                  <div className="font-medium">{row.studentName}</div>
                  <div className="text-[11px] text-muted-foreground">{row.studentEmail}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium">{row.assessmentTitle}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {row.status.replaceAll("_", " ")}
                  </div>
                </td>
                <td className="py-3 px-4 text-[12px] text-muted-foreground">
                  {row.completedAt ? new Date(row.completedAt).toLocaleString() : "—"}
                </td>
                <td className="py-3 px-4">
                  <span className="font-semibold">{row.riskScore}</span>
                  <span
                    className={cn(
                      "ml-2 text-[11px] font-semibold uppercase",
                      row.riskLevel === "HIGH" || row.riskLevel === "CRITICAL"
                        ? "text-danger"
                        : row.riskLevel === "MEDIUM"
                          ? "text-amber-700"
                          : "text-success",
                    )}
                  >
                    {row.riskLevel}
                  </span>
                </td>
                <td className="py-3 px-4 text-[12px]">
                  <div className="font-medium">
                    {row.reviewDecisionLabel ?? "Not reviewed yet"}
                  </div>
                  {row.reviewerName ? (
                    <div className="text-[11px] text-muted-foreground">{row.reviewerName}</div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground">Unreviewed</div>
                  )}
                </td>
                <td className="py-3 px-4 text-[12px]">
                  {!row.hasProctoringData
                    ? "No proctoring data"
                    : row.derivedIncidentCount === 0
                      ? "No recorded incidents"
                      : `${row.derivedIncidentCount} derived`}
                  {row.hasProctoringData ? (
                    <div className="text-[11px] text-muted-foreground">
                      {row.rawEventCount} raw events
                      {row.topCategory ? ` · ${row.topCategory}` : ""}
                    </div>
                  ) : null}
                </td>
                <td className="py-3 px-4 text-[12px]">{row.recommendation}</td>
                <td className="py-3 px-4">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/results/${row.id}`}>Review</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {!data && !error && (
              <tr>
                <td colSpan={8} className="py-8 px-4 text-center text-muted-foreground">
                  Loading proctoring review…
                </td>
              </tr>
            )}
            {data && data.queue.length === 0 && (
              <tr>
                <td colSpan={8} className="py-8 px-4 text-center text-muted-foreground">
                  {queueEmptyMessage(data.emptyReason, risk)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {data ? `${data.total} in this queue` : pending ? "Loading…" : ""}
          {data ? ` · Page ${data.page} of ${data.pageCount}` : ""}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!data || data.page <= 1 || pending}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!data || data.page >= data.pageCount || pending}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}

function queueEmptyMessage(reason: QueuePayload["emptyReason"], risk: string) {
  if (reason === "in_progress") {
    return "In-progress attempts are not included in proctoring review.";
  }
  if (reason === "no_attempts") {
    return "No assessment attempts available for proctoring review.";
  }
  if (risk === "needs_review" || risk === "HIGH" || risk === "CRITICAL") {
    return "No high-risk attempts match these filters.";
  }
  return "No attempts match these filters.";
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="card-soft px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="font-display font-bold text-xl mt-1">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-1">{detail}</div>
    </div>
  );
}

function Distribution({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm py-1">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
