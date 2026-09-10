"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitInterviewEvaluationAction } from "@/lib/actions/interviewer";
import type { EvaluationFormContext } from "@/lib/interviewer/queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

export function EvaluationFormClient({ context }: { context: EvaluationFormContext }) {
  const router = useRouter();
  const [score, setScore] = useState(
    context.existing ? String(context.existing.score) : "",
  );
  const [notes, setNotes] = useState(context.existing?.notes ?? "");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const readOnly = Boolean(context.existing);

  const onSubmit = () => {
    if (readOnly) return;
    setError("");
    startTransition(async () => {
      const result = await submitInterviewEvaluationAction({
        interviewId: context.interviewId,
        score,
        notes,
      });

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      router.push("/interviewer/evaluations");
      router.refresh();
    });
  };

  return (
    <div>
      <PageHeader
        title={readOnly ? "Evaluation Submitted" : "Submit Evaluation"}
        description={`${context.candidateName} · ${context.title}`}
      />

      <div className="card-soft p-5 max-w-xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
            {context.candidateInitials}
          </div>
          <div>
            <div className="font-semibold text-sm">{context.candidateName}</div>
            <div className="text-[11px] text-muted-foreground">
              {context.title} · {context.type} · {context.formattedDate} ·{" "}
              {context.formattedTime}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="score">
            Score (%)
          </label>
          <Input
            id="score"
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            disabled={readOnly || pending}
            placeholder="0 – 100"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-semibold" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly || pending}
            placeholder="Interview notes and feedback…"
            className="w-full min-h-[160px] rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </div>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}

        {readOnly ? (
          <p className="text-sm text-muted-foreground">
            Submitted on {context.existing?.submittedAtLabel}. Evaluations are
            read-only after submission.
          </p>
        ) : (
          <div className="flex gap-3">
            <Button asChild variant="outline">
              <Link href="/interviewer/evaluations">Cancel</Link>
            </Button>
            <Button onClick={onSubmit} disabled={pending}>
              {pending ? "Submitting…" : "Submit Evaluation"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
