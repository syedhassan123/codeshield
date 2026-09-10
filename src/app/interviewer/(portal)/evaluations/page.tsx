import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { connectDB } from "@/lib/db";
import { listInterviewerEvaluations } from "@/lib/interviewer/queries";
import { requirePageRole } from "@/lib/safe-auth";

export default async function InterviewerEvaluationsPage() {
  const session = await requirePageRole(["interviewer"]);

  let pending: Awaited<
    ReturnType<typeof listInterviewerEvaluations>
  >["pending"] = [];
  let completed: Awaited<
    ReturnType<typeof listInterviewerEvaluations>
  >["completed"] = [];
  let loadError = false;

  try {
    await connectDB();
    const data = await listInterviewerEvaluations(session.user.id);
    pending = data.pending;
    completed = data.completed;
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="Evaluations"
        description="Completed interview assessments."
      />

      {loadError && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Unable to load evaluations. Please try again.
        </div>
      )}

      {pending.length === 0 && completed.length === 0 ? (
        <div className="card-soft p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No interview evaluations available yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display font-bold text-sm">Pending</h3>
              {pending.map((item) => (
                <div
                  key={item.interviewId}
                  className="card-soft p-4 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
                    {item.candidateInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{item.candidateName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.title} · {item.formattedDate} · {item.type}
                    </div>
                  </div>
                  <Link
                    href={`/interviewer/evaluations/${item.interviewId}`}
                    className="text-xs font-semibold text-primary"
                  >
                    Evaluate
                  </Link>
                </div>
              ))}
            </section>
          )}

          {completed.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display font-bold text-sm">Completed</h3>
              {completed.map((item) => (
                <Link
                  key={item.interviewId}
                  href={`/interviewer/evaluations/${item.interviewId}`}
                  className="card-soft p-4 flex items-center gap-3 hover:border-primary transition block"
                >
                  <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
                    {item.candidateInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{item.candidateName}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {item.title} · {item.formattedDate}
                    </div>
                  </div>
                  <div className="text-lg font-display font-bold">
                    {item.score} %
                  </div>
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
