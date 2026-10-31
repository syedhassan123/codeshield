"use client";

import { useState, useTransition } from "react";
import { submitProctoringReviewAction } from "@/lib/actions/grading";
import {
  PROCTORING_CASE_DECISIONS,
  proctoringCaseDecisionLabel,
  type ProctoringCaseDecision,
  type ProctoringCaseReviewView,
} from "@/lib/proctoring/case-review";
import { Button } from "@/components/ui/button";

export function AdminProctoringCaseReview({
  attemptId,
  attemptStatus,
  review,
}: {
  attemptId: string;
  attemptStatus: string;
  review: ProctoringCaseReviewView;
}) {
  const [current, setCurrent] = useState(review);
  const [decision, setDecision] = useState<ProctoringCaseDecision | "">(
    review.decision ?? "",
  );
  const [note, setNote] = useState(review.note);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [pending, startTransition] = useTransition();
  const canSubmit = attemptStatus === "submitted" || attemptStatus === "expired";

  return (
    <section className="card-soft p-5 mb-5">
      <h3 className="font-display font-bold text-sm">Proctoring review</h3>
      <p className="text-sm text-muted-foreground mt-1 mb-4">
        This decision does not change the risk score, evidence, or exam result.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 mb-4 text-sm">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Current decision
          </div>
          <div className="mt-1 font-medium">{current.decisionLabel}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Reviewed by
          </div>
          <div className="mt-1">{current.reviewerName ?? "—"}</div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            Reviewed at
          </div>
          <div className="mt-1">
            {current.reviewedAt ? new Date(current.reviewedAt).toLocaleString() : "—"}
          </div>
        </div>
      </div>

      {canSubmit ? (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!decision) return;
            setError("");
            setSaved("");
            startTransition(async () => {
              const result = await submitProctoringReviewAction({
                attemptId,
                decision,
                note,
                expectedVersion: current.version,
              });
              if ("error" in result && result.error) {
                setError(
                  result.error === "Something went wrong."
                    ? "Unable to save proctoring review."
                    : result.error,
                );
                return;
              }
              if ("review" in result && result.review) {
                setCurrent(result.review);
                setNote(result.review.note);
                setDecision(result.review.decision ?? "");
                setSaved("Review saved.");
              }
            });
          }}
        >
          <label className="block text-sm">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Decision
            </span>
            <select
              className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
              value={decision}
              onChange={(event) =>
                setDecision(
                  event.target.value === "CLEARED" ||
                    event.target.value === "FLAGGED" ||
                    event.target.value === "NEEDS_FOLLOW_UP"
                    ? event.target.value
                    : "",
                )
              }
            >
              <option value="">Choose a decision</option>
              {PROCTORING_CASE_DECISIONS.map((value) => (
                <option key={value} value={value}>
                  {proctoringCaseDecisionLabel(value)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              Internal note
            </span>
            <textarea
              className="mt-1 min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              maxLength={5000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Optional note for other administrators"
            />
          </label>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending || !decision}>
              {pending ? "Saving…" : "Save review"}
            </Button>
            {saved ? <span className="text-sm text-success">{saved}</span> : null}
          </div>
          {error ? (
            <p className="text-sm font-semibold text-danger">{error}</p>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            Cleared means no further action. Flagged marks the attempt for
            administrative attention. Needs follow-up is for ambiguous or
            incomplete evidence. None of these change the student result.
          </p>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">
          Proctoring review is available after the attempt is submitted or expired.
        </p>
      )}

      {current.history.length > 0 && (
        <div className="mt-5">
          <h4 className="text-sm font-semibold mb-2">Earlier decisions</h4>
          <ul className="space-y-3">
            {current.history.map((entry) => (
              <li key={`${entry.version}-${entry.reviewedAt}`} className="text-sm">
                <div className="font-medium">{entry.decisionLabel}</div>
                <div className="text-[12px] text-muted-foreground">
                  {entry.reviewerName} · {new Date(entry.reviewedAt).toLocaleString()}
                </div>
                {entry.note ? <p className="mt-1">{entry.note}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
