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
  const evaluationPending = result.evaluationStatus === "pending";

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

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
            <ScoreCard
              label="Objective"
              value={`${result.objectiveScore} / ${result.objectiveMaxMarks}`}
            />
            <ScoreCard
              label="Subjective"
              value={`${result.subjectiveScore} / ${result.subjectiveMaxMarks}`}
            />
            <ScoreCard
              label="Coding"
              value={`${result.codingScore} / ${result.codingMaxMarks}`}
            />
            <ScoreCard
              label="Final score"
              value={`${result.finalScore} / ${result.totalMarks}`}
            />
            <ScoreCard
              label="Evaluation"
              value={
                evaluationPending ? "Pending" : "Completed"
              }
            />
            <ScoreCard
              label="Attempt"
              value={attempt.status.replace("_", " ")}
            />
          </div>

          {(() => {
            const codingQs = result.questions.filter((q) => q.type === "coding");
            if (!codingQs.length) return null;
            const passed = codingQs.reduce(
              (sum, q) => sum + (q.passedTests || 0),
              0,
            );
            const total = codingQs.reduce(
              (sum, q) => sum + (q.totalTests || 0),
              0,
            );
            return (
              <div className="mt-4 rounded-xl border border-border p-4 text-sm">
                <p className="font-semibold">Coding</p>
                <p className="text-muted-foreground mt-1">
                  {codingQs.length} Question{codingQs.length === 1 ? "" : "s"} ·{" "}
                  {passed}/{total || "—"} Tests Passed · {result.codingScore}/
                  {result.codingMaxMarks} Marks
                </p>
              </div>
            );
          })()}

          {evaluationPending && (
            <p className="text-sm text-muted-foreground mt-4">
              Some subjective answers are still pending admin evaluation. Your
              final score will update when grading is complete.
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
                    q.evalStatus === "manually_graded" && "text-success",
                    q.evalStatus === "auto_graded" && "text-success",
                  )}
                >
                  {q.evalStatus === "correct" &&
                    `Correct (+${q.awardedPoints})`}
                  {q.evalStatus === "incorrect" &&
                    (q.type === "coding"
                      ? `0/${q.points} marks`
                      : "Incorrect")}
                  {q.evalStatus === "pending_evaluation" &&
                    "Pending evaluation"}
                  {q.evalStatus === "manually_graded" &&
                    `Graded (+${q.awardedPoints})`}
                  {q.evalStatus === "auto_graded" &&
                    `Auto graded (+${q.awardedPoints})`}
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
              ) : q.type === "coding" ? (
                <div className="mt-2 text-sm space-y-2">
                  <p className="text-muted-foreground">
                    Language:{" "}
                    <span className="font-semibold text-foreground">
                      {q.selectedOptionKey || "—"}
                    </span>
                    {" · "}
                    Tests:{" "}
                    <span className="font-semibold text-foreground">
                      {q.passedTests}/{q.totalTests}
                    </span>
                    {" · "}
                    Marks:{" "}
                    <span className="font-semibold text-foreground">
                      {q.awardedPoints}/{q.points}
                    </span>
                  </p>
                  {q.feedback?.trim() && (
                    <p>
                      <span className="font-semibold">Status: </span>
                      {q.feedback}
                    </p>
                  )}
                  <pre className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3 font-mono text-xs">
                    {q.textAnswer.trim() || "No code submitted."}
                  </pre>
                </div>
              ) : (
                <>
                  <pre className="mt-2 text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3">
                    {q.textAnswer.trim() || "No answer submitted."}
                  </pre>
                  {q.feedback?.trim() && (
                    <p className="mt-2 text-sm">
                      <span className="font-semibold">Feedback: </span>
                      {q.feedback}
                    </p>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-xl mt-1 capitalize">
        {value}
      </div>
    </div>
  );
}
