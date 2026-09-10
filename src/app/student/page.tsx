import Link from "next/link";
import { ArrowRight, Bell, Calendar, Video } from "lucide-react";
import { ActivityAreaChart } from "@/components/charts/simple-charts";
import { DashboardSection } from "@/components/ui/dashboard-section";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { connectDB } from "@/lib/db";
import { getStudentDashboardData } from "@/lib/student/dashboard-queries";
import { requirePageRole } from "@/lib/safe-auth";
import {
  displayDifficulty,
  displayType,
} from "@/lib/serializers";
import { cn } from "@/lib/utils";

function attemptStatusLabel(
  status: "not_started" | "in_progress" | "completed",
) {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    default:
      return "Not started";
  }
}

function attemptStatusVariant(
  status: "not_started" | "in_progress" | "completed",
) {
  switch (status) {
    case "in_progress":
      return "primary" as const;
    case "completed":
      return "success" as const;
    default:
      return "muted" as const;
  }
}

export default async function StudentDashboardPage() {
  const session = await requirePageRole(["student"]);
  const first = session.user.name?.split(" ")[0] || "there";

  let dashboard = {
    stats: {
      assessmentsTaken: 0,
      codingSolved: 0,
      interviews: 0,
      certificates: 0,
      averageScorePercent: null as number | null,
      inProgressAttempts: 0,
    },
    upcoming: [] as Awaited<
      ReturnType<typeof getStudentDashboardData>
    >["upcoming"],
    performanceTrend: [] as Awaited<
      ReturnType<typeof getStudentDashboardData>
    >["performanceTrend"],
    activity: [] as Awaited<
      ReturnType<typeof getStudentDashboardData>
    >["activity"],
    upcomingInterviews: [] as Awaited<
      ReturnType<typeof getStudentDashboardData>
    >["upcomingInterviews"],
  };

  try {
    await connectDB();
    dashboard = await getStudentDashboardData(session.user.id);
  } catch {
    dashboard = {
      stats: dashboard.stats,
      upcoming: [],
      performanceTrend: [],
      activity: [],
      upcomingInterviews: [],
    };
  }

  const { stats, upcoming, performanceTrend, activity, upcomingInterviews } =
    dashboard;

  const trendMeta =
    stats.averageScorePercent != null
      ? `Avg score ${stats.averageScorePercent}%`
      : stats.inProgressAttempts > 0
        ? `${stats.inProgressAttempts} in progress`
        : "Last 7 days";

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={`Hi ${first} 👋`}
        description="Ready for your next challenge? Let's keep the streak going."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Assessments Taken"
          value={stats.assessmentsTaken.toLocaleString()}
          emphasis
        />
        <StatCard
          label="Coding Solved"
          value={stats.codingSolved.toLocaleString()}
          emphasis
        />
        <StatCard
          label="Interviews"
          value={stats.interviews.toLocaleString()}
          emphasis
        />
        <StatCard
          label="Certificates"
          value={stats.certificates.toLocaleString()}
          emphasis
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
        <DashboardSection
          className="lg:col-span-2"
          title="Performance Trend"
          meta={trendMeta}
        >
          <ActivityAreaChart data={performanceTrend} height="md" />
        </DashboardSection>

        <DashboardSection
          title="Notifications"
          action={
            <Bell className="w-4 h-4 text-muted-foreground" aria-hidden />
          }
          bodyClassName="max-h-52 overflow-y-auto pr-0.5 -mr-0.5"
        >
          {activity.length ? (
            <ul className="divide-y divide-border">
              {activity.map((item) => (
                <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="block group rounded-lg -mx-1 px-1 py-0.5 hover:bg-muted/40 transition-colors"
                    >
                      <p className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors">
                        {item.text}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.time}
                      </p>
                    </Link>
                  ) : (
                    <>
                      <p className="text-sm font-semibold leading-snug">
                        {item.text}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {item.time}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No recent activity yet.
            </p>
          )}
        </DashboardSection>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-5">
        <DashboardSection
          title="Upcoming Assessments"
          action={
            <Link
              href="/student/assessments"
              className="text-xs font-semibold text-primary inline-flex items-center gap-1 hover:underline"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          }
        >
          {upcoming.length ? (
            <ul className="space-y-2.5">
              {upcoming.map((a) => (
                <li key={a.id}>
                  <Link
                    href={
                      a.attemptStatus === "in_progress" &&
                      a.inProgressAttemptId
                        ? `/student/exam/session/${a.inProgressAttemptId}`
                        : `/student/exam/${a.id}`
                    }
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/20 transition-colors group"
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold",
                        "bg-primary-soft text-primary",
                      )}
                    >
                      {displayDifficulty(a.difficulty)[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm truncate">
                          {a.title}
                        </span>
                        <StatusBadge variant={attemptStatusVariant(a.attemptStatus)}>
                          {attemptStatusLabel(a.attemptStatus)}
                        </StatusBadge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {displayType(a.type)} · {a.durationMin} min ·{" "}
                        {a.questionCount} Qs · {displayDifficulty(a.difficulty)}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-8 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No published assessments yet.
              </p>
            </div>
          )}
        </DashboardSection>

        <DashboardSection title="Upcoming Interviews">
          {upcomingInterviews.length ? (
            <ul className="space-y-2.5">
              {upcomingInterviews.map((interview) => (
                <li key={interview.id}>
                  <Link
                    href={`/interviewer/lobby/${interview.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/20 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold bg-primary-soft text-primary">
                      <Video className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {interview.title}
                        </p>
                        <StatusBadge variant="primary" className="text-[10px]">
                          {interview.displayStatus}
                        </StatusBadge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {interview.type} · with {interview.interviewerName} ·{" "}
                        {interview.formattedDate} · {interview.formattedTime}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-primary transition" />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center mb-3">
                <Video className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">
                No interviews scheduled
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
                Assigned interviews will appear here when scheduled by your
                administrator.
              </p>
            </div>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
