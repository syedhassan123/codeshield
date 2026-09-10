import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import { getInterviewerDashboardMetrics } from "@/lib/interviewer/queries";
import { requirePageRole } from "@/lib/safe-auth";

export default async function InterviewerDashboardPage() {
  const session = await requirePageRole(["interviewer"]);
  const first = session.user.name?.split(" ")[0] || "there";

  let metrics = {
    todayCount: 0,
    weekCount: 0,
    completedCount: 0,
    avgRating: null as number | null,
    todaySchedule: [] as Awaited<
      ReturnType<typeof getInterviewerDashboardMetrics>
    >["todaySchedule"],
    pendingEvaluationsCount: 0,
    pendingEvaluations: [] as Awaited<
      ReturnType<typeof getInterviewerDashboardMetrics>
    >["pendingEvaluations"],
  };
  let loadError = false;

  try {
    await connectDB();
    metrics = await getInterviewerDashboardMetrics(session.user.id);
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title={`Good morning, ${first} 👋`}
        description="Here's your interview schedule for today."
      />

      {loadError && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Unable to load interviews. Please try again.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Interviews" value={String(metrics.todayCount)} />
        <StatCard label="This Week" value={String(metrics.weekCount)} />
        <StatCard label="Completed" value={String(metrics.completedCount)} />
        <StatCard
          label="Avg Rating"
          value={
            metrics.avgRating == null ? "—" : `${metrics.avgRating}%`
          }
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Today&apos;s Schedule</h3>
          <div className="space-y-3">
            {metrics.todaySchedule.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No interviews scheduled for today.
              </p>
            ) : (
              metrics.todaySchedule.map((interview) => (
                <div
                  key={interview.id}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary transition"
                >
                  <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
                    {interview.candidateInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">
                      {interview.candidateName}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {interview.title} · {interview.formattedTime} ·{" "}
                      {interview.durationMin} m
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {interview.type}
                    </div>
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/interviewer/lobby/${interview.id}`}>
                      Start <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Pending Evaluations</h3>
          <div className="space-y-2">
            {metrics.pendingEvaluations.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No pending evaluations.
              </p>
            ) : (
              metrics.pendingEvaluations.map((item) => (
                <Link
                  key={item.interviewId}
                  href={`/interviewer/evaluations/${item.interviewId}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-bold">
                    {item.candidateInitials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">
                      {item.candidateName}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {item.title}
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-primary">
                    Evaluate
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
