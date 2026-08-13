"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  completeEvaluationAction,
  gradeQuestionAction,
} from "@/lib/actions/grading";
import type { SerializedAttempt, SerializedResult } from "@/lib/serializers";
import { displayType } from "@/lib/serializers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { AdminSecurityReport } from "@/components/admin/admin-security-report";
import { cn } from "@/lib/utils";
import type { SecuritySummary } from "@/lib/exam/security";
import type { SerializedSecurityEvent } from "@/lib/actions/exam-security";

export function AdminAttemptDetailClient({
  attempt: initialAttempt,
  student,
  assessment,
  result: initialResult,
  timeTaken,
  security,
}: {
  attempt: SerializedAttempt;
  student: { id: string; name: string; email: string };
  assessment: {
    id: string;
    title: string;
    type: string;
    durationMin: number;
    totalMarks: number;
  };
  result: SerializedResult | null;
  timeTaken: string | null;
  security?: {
    summary: SecuritySummary;
    events: SerializedSecurityEvent[];
  } | null;
}) {
  const [attempt] = useState(initialAttempt);
  const [result, setResult] = useState(initialResult);
  const [drafts, setDrafts] = useState<
    Record<string, { marks: string; feedback: string }>
  >(() => {
    const map: Record<string, { marks: string; feedback: string }> = {};
    for (const q of initialResult?.questions ?? []) {
      if (q.type !== "mcq") {
        map[q.questionId] = {
          marks: String(q.awardedPoints ?? 0),
          feedback: q.feedback ?? "",
        };
      }
    }
    return map;
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();

  const saveGrade = (questionId: string) => {
    const draft = drafts[questionId];
    if (!draft) return;
    setError("");
    setMessage("");
    startTransition(async () => {
      const res = await gradeQuestionAction({
        attemptId: attempt.id,
        questionId,
        marks: Number(draft.marks),
        feedback: draft.feedback,
      });
      if ("error" in res && res.error) {
        setError(res.error);
        console.log(res.error)
        return;
      }
      if ("result" in res && res.result) {
        setResult(res.result);
        setMessage("Grading saved. Score recalculated.");
        console.log(res.result)
      }
    });
  };

  const complete = () => {
    setError("");
    setMessage("");
    startTransition(async () => {
      const res = await completeEvaluationAction(attempt.id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("result" in res && res.result) {
        setResult(res.result);
        setMessage("Evaluation marked completed.");
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="Attempt details"
        description={assessment.title}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/results">Back to results</Link>
          </Button>
        }
      />

      <div className="grid lg:grid-cols-3 gap-4 mb-5">
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-3">Student</h3>
          <p className="font-semibold">{student.name}</p>
          <p className="text-sm text-muted-foreground">{student.email}</p>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-3">Assessment</h3>
          <p className="font-semibold">{assessment.title}</p>
          <p className="text-sm text-muted-foreground">
            {displayType(assessment.type)} · {assessment.durationMin} min ·{" "}
            {assessment.totalMarks} marks
          </p>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-3">Attempt</h3>
          <p className="text-sm capitalize">
            Status: <strong>{attempt.status.replace("_", " ")}</strong>
          </p>
          <p className="text-sm mt-1">
            Started: {new Date(attempt.startedAt).toLocaleString()}
          </p>
          <p className="text-sm mt-1">
            Submitted:{" "}
            {attempt.submittedAt
              ? new Date(attempt.submittedAt).toLocaleString()
              : "—"}
          </p>
          <p className="text-sm mt-1">Time taken: {timeTaken ?? "—"}</p>
        </div>
      </div>

      {security && (
        <AdminSecurityReport
          summary={security.summary}
          events={security.events}
        />
      )}

      {result ? (
        <>
          <div className="card-soft p-5 mb-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-display font-bold">Scores</h3>
              <span
                className={cn(
                  "text-xs font-semibold uppercase",
                  result.evaluationStatus === "completed"
                    ? "text-success"
                    : "text-primary",
                )}
              >
                Evaluation: {result.evaluationStatus}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <ScoreTile
                label="Objective"
                value={`${result.objectiveScore}/${result.objectiveMaxMarks}`}
              />
              <ScoreTile
                label="Subjective"
                value={`${result.subjectiveScore}/${result.subjectiveMaxMarks}`}
              />
              <ScoreTile
                label="Coding"
                value={`${result.codingScore}/${result.codingMaxMarks}`}
              />
              <ScoreTile
                label="Final"
                value={`${result.finalScore}/${result.totalMarks}`}
              />
              <ScoreTile
                label="Pending"
                value={String(result.subjectivePendingCount)}
              />
            </div>
            {result.evaluationStatus === "pending" && (
              <p className="text-sm text-muted-foreground mt-3">
                Grade remaining subjective answers to complete evaluation.
                Coding scores are calculated automatically from test cases.
              </p>
            )}
            <div className="mt-4">
              <Button
                size="sm"
                onClick={complete}
                disabled={pending || result.evaluationStatus === "completed"}
              >
                Mark evaluation complete
              </Button>
            </div>
          </div>

          {error && (
            <div className="mb-4 text-sm font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          {message && (
            <div className="mb-4 text-sm font-semibold text-success bg-success-soft px-3 py-2 rounded-lg">
              {message}
            </div>
          )}

          <div className="space-y-4">
            {result.questions.map((q, i) => {
              const manual = q.type === "subjective";
              const draft = drafts[q.questionId] ?? {
                marks: String(q.awardedPoints),
                feedback: q.feedback,
              };
              return (
                <div key={q.questionId} className="card-soft p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-muted">
                      Q{i + 1} · {displayType(q.type)} · max {q.points}
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
                      {labelForEval(q.evalStatus, q.awardedPoints)}
                    </span>
                  </div>
                  <p className="font-medium whitespace-pre-wrap mb-3">
                    {q.prompt}
                  </p>

                  {q.type === "mcq" ? (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        Student answer:{" "}
                        <strong className="text-foreground">
                          {q.selectedOptionKey || "—"}
                        </strong>
                      </p>
                      <p>
                        Correct answer:{" "}
                        <strong className="text-foreground">
                          {q.correctOptionKey || "—"}
                        </strong>
                      </p>
                      <p>
                        Auto marks:{" "}
                        <strong className="text-foreground">
                          {q.awardedPoints}/{q.points}
                        </strong>
                      </p>
                    </div>
                  ) : q.type === "coding" ? (
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>
                          Language:{" "}
                          <strong className="text-foreground">
                            {q.selectedOptionKey || "—"}
                          </strong>
                        </p>
                        <p>
                          Tests passed:{" "}
                          <strong className="text-foreground">
                            {q.passedTests}/{q.totalTests}
                          </strong>
                        </p>
                        <p>
                          Coding score:{" "}
                          <strong className="text-foreground">
                            {q.awardedPoints}/{q.points}
                          </strong>
                        </p>
                        {q.gradedAt && (
                          <p>
                            Graded at:{" "}
                            <strong className="text-foreground">
                              {new Date(q.gradedAt).toLocaleString()}
                            </strong>
                          </p>
                        )}
                        {q.feedback?.trim() && (
                          <p>
                            Status:{" "}
                            <strong className="text-foreground">
                              {q.feedback}
                            </strong>
                          </p>
                        )}
                      </div>
                      <pre className="text-xs whitespace-pre-wrap rounded-lg bg-slate-950 text-slate-100 font-mono p-3">
                        {q.textAnswer.trim() || "No code submitted."}
                      </pre>
                      <div className="grid md:grid-cols-[140px_1fr_auto] gap-3 items-end">
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            Override marks (0–{q.points})
                          </label>
                          <Input
                            type="number"
                            min={0}
                            max={q.points}
                            step={0.5}
                            className="mt-1.5"
                            value={draft.marks}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [q.questionId]: {
                                  ...draft,
                                  marks: e.target.value,
                                },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-muted-foreground">
                            Feedback
                          </label>
                          <Input
                            className="mt-1.5"
                            value={draft.feedback}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [q.questionId]: {
                                  ...draft,
                                  feedback: e.target.value,
                                },
                              }))
                            }
                            placeholder="Optional override note"
                          />
                        </div>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => saveGrade(q.questionId)}
                        >
                          Override grade
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <pre className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3 mb-4">
                        {q.textAnswer.trim() || "No answer submitted."}
                      </pre>
                      {manual && (
                        <div className="grid md:grid-cols-[140px_1fr_auto] gap-3 items-end">
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">
                              Marks (0–{q.points})
                            </label>
                            <Input
                              type="number"
                              min={0}
                              max={q.points}
                              step={0.5}
                              className="mt-1.5"
                              value={draft.marks}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [q.questionId]: {
                                    ...draft,
                                    marks: e.target.value,
                                  },
                                }))
                              }
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-muted-foreground">
                              Feedback
                            </label>
                            <Input
                              className="mt-1.5"
                              value={draft.feedback}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [q.questionId]: {
                                    ...draft,
                                    feedback: e.target.value,
                                  },
                                }))
                              }
                              placeholder="Optional feedback for student"
                            />
                          </div>
                          <Button
                            size="sm"
                            disabled={pending}
                            onClick={() => saveGrade(q.questionId)}
                          >
                            Save grade
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="card-soft p-8 text-center text-muted-foreground">
          This attempt is still in progress. Grading unlocks after submission.
        </div>
      )}
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-display font-bold text-lg mt-1">{value}</div>
    </div>
  );
}

function labelForEval(status: string, awarded: number) {
  if (status === "correct") return `Correct (+${awarded})`;
  if (status === "incorrect") return "Incorrect";
  if (status === "pending_evaluation") return "Pending evaluation";
  if (status === "manually_graded") return `Manually graded (+${awarded})`;
  if (status === "auto_graded") return `Auto graded (+${awarded})`;
  return status;
}
