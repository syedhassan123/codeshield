"use client";

import Link from "next/link";
import type { SerializedAttempt, SerializedResult } from "@/lib/serializers";
import { displayType } from "@/lib/serializers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ExamResultClient({
  attempt,
  result,
}: {
  attempt: SerializedAttempt;
  result: SerializedResult;
}) {
  const submittedLabel = new Date(result.submittedAt).toLocaleString();
  const statusLabel =
    attempt.status === "expired" ? "Time expired" : "Submitted";

  return (
    <div className="min-h-screen bg-background relative p-6">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="relative max-w-3xl mx-auto space-y-4">
        <div className="card-soft p-6 md:p-8 shadow-elevated">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Exam result
          </p>
          <h1 className="font-display font-bold text-2xl mt-1">
            {result.assessmentTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            {statusLabel} · {submittedLabel}
            {result.finalizedReason === "expired" ? " · auto-submitted" : ""}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
            <div className="rounded-xl border border-border p-3">
              <div className="text-[11px] text-muted-foreground">
                Objective score
              </div>
              <div className="font-display font-bold text-xl mt-1">
                {result.objectiveScore}
                <span className="text-sm text-muted-foreground font-medium">
                  {" "}
                  / {result.objectiveMaxMarks}
                </span>
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-[11px] text-muted-foreground">
                Total marks
              </div>
              <div className="font-display font-bold text-xl mt-1">
                {result.totalMarks}
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-[11px] text-muted-foreground">
                Pending subjective
              </div>
              <div className="font-display font-bold text-xl mt-1">
                {result.subjectivePendingCount}
              </div>
            </div>
            <div className="rounded-xl border border-border p-3">
              <div className="text-[11px] text-muted-foreground">Status</div>
              <div className="font-display font-bold text-lg mt-1 capitalize">
                {attempt.status.replace("_", " ")}
              </div>
            </div>
          </div>

          {result.subjectiveMaxMarks > 0 && (
            <p className="text-sm text-muted-foreground mt-4">
              Subjective / coding answers ({result.subjectiveMaxMarks} marks)
              are saved and pending evaluation. AI grading is not applied yet.
            </p>
          )}

          <div className="flex gap-3 mt-6">
            <Button asChild>
              <Link href="/student/results">All results</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/student/assessments">Back to assessments</Link>
            </Button>
          </div>
        </div>

        <div className="card-soft p-5 md:p-6 space-y-4">
          <h2 className="font-display font-bold text-lg">Breakdown</h2>
          {result.questions.map((q, i) => (
            <div
              key={`${q.questionId}-${i}`}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-muted">
                  Q{i + 1} · {displayType(q.type)} · {q.points} marks
                </span>
                <span
                  className={cn(
                    "text-xs font-semibold",
                    q.evalStatus === "correct" && "text-success",
                    q.evalStatus === "incorrect" && "text-danger",
                    q.evalStatus === "pending_evaluation" && "text-primary",
                  )}
                >
                  {q.evalStatus === "correct" &&
                    `Correct (+${q.awardedPoints})`}
                  {q.evalStatus === "incorrect" && "Incorrect"}
                  {q.evalStatus === "pending_evaluation" &&
                    "Pending evaluation"}
                  {q.evalStatus === "ungraded" && "Ungraded"}
                </span>
              </div>
              <p className="text-sm font-medium whitespace-pre-wrap">
                {q.prompt}
              </p>
              {q.type === "mcq" ? (
                <div className="mt-2 text-sm text-muted-foreground space-y-1">
                  <p>
                    Your answer:{" "}
                    <span className="font-semibold text-foreground">
                      {q.selectedOptionKey || "—"}
                    </span>
                  </p>
                  <p>
                    Correct answer:{" "}
                    <span className="font-semibold text-foreground">
                      {q.correctOptionKey || "—"}
                    </span>
                  </p>
                </div>
              ) : (
                <pre className="mt-2 text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3">
                  {q.textAnswer.trim() || "No answer submitted."}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
