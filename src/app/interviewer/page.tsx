import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { mockEvaluations, mockInterviews } from "@/lib/mock-data";
import { initials } from "@/lib/utils";

export default async function InterviewerDashboardPage() {
  const session = await auth();
  const first = session?.user?.name?.split(" ")[0] || "there";

  return (
    <div>
      <PageHeader
        title={`Good morning, ${first} 👋`}
        description="Here's your interview schedule for today."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Today's Interviews" value="4" />
        <StatCard label="This Week" value="18" />
        <StatCard label="Completed" value="184" />
        <StatCard label="Avg Rating" value="4.7" />
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-5">
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Today&apos;s Schedule</h3>
          <div className="space-y-3">
            {mockInterviews.slice(0, 4).map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary transition"
              >
                <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
                  {initials(i.candidate)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{i.candidate}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {i.role} · {i.date.split(" · ")[1] || i.date} · {i.duration} m
                  </div>
                  <div className="text-[11px] text-muted-foreground">{i.type}</div>
                </div>
                <Button asChild size="sm">
                  <Link href={`/interviewer/lobby/${i.id}`}>
                    Start <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Pending Evaluations</h3>
          <div className="space-y-2">
            {mockEvaluations.slice(0, 6).map((e) => (
              <div
                key={`${e.name}-${e.date}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/40"
              >
                <div className="w-9 h-9 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-bold">
                  {initials(e.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{e.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {e.role}
                  </div>
                </div>
                <span className="text-xs font-semibold text-primary">Evaluate</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
