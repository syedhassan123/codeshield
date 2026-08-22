import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import { ActivityAreaChart } from "@/components/charts/simple-charts";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { connectDB } from "@/lib/db";
import { getStudentDashboardData } from "@/lib/student/dashboard-queries";
import { requirePageRole } from "@/lib/safe-auth";
import {
  displayDifficulty,
  displayType,
} from "@/lib/serializers";

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
    };
  }

  const { stats, upcoming, performanceTrend, activity } = dashboard;

  return (
    <div>
      <PageHeader
        title={`Hi ${first} 👋`}
        description="Ready for your next challenge? Let's keep the streak going."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Assessments Taken"
          value={stats.assessmentsTaken.toLocaleString()}
        />
        <StatCard
          label="Coding Solved"
          value={stats.codingSolved.toLocaleString()}
        />
        <StatCard label="Interviews" value={stats.interviews.toLocaleString()} />
        <StatCard
          label="Certificates"
          value={stats.certificates.toLocaleString()}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Performance Trend</h3>
            <span className="text-xs font-semibold text-muted-foreground">
              {stats.averageScorePercent != null
                ? `Avg score ${stats.averageScorePercent}%`
                : stats.inProgressAttempts > 0
                  ? `${stats.inProgressAttempts} in progress`
                  : "Last 7 days"}
            </span>
          </div>
          <ActivityAreaChart data={performanceTrend} />
        </div>
        <div className="card-soft p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display font-bold">Notifications</h3>
          </div>
          <div className="space-y-2">
            {activity.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 items-start p-2 rounded-lg hover:bg-muted/40"
              >
                <span className="text-primary mt-1">•</span>
                <div className="min-w-0">
                  {item.href ? (
                    <Link
                      href={item.href}
                      className="text-sm font-semibold hover:text-primary"
                    >
                      {item.text}
                    </Link>
                  ) : (
                    <div className="text-sm font-semibold">{item.text}</div>
                  )}
                  <div className="text-[11px] text-muted-foreground">
                    {item.time}
                  </div>
                </div>
              </div>
            ))}
            {!activity.length && (
              <p className="text-sm text-muted-foreground py-2">
                No recent activity yet.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Upcoming Assessments</h3>
            <Link
              href="/student/assessments"
              className="text-xs font-semibold text-primary inline-flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="space-y-3">
            {upcoming.map((a) => (
              <Link
                key={a.id}
                href={
                  a.attemptStatus === "in_progress" && a.inProgressAttemptId
                    ? `/student/exam/session/${a.inProgressAttemptId}`
                    : `/student/exam/${a.id}`
                }
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-xs font-bold">
                  {displayDifficulty(a.difficulty)[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {displayType(a.type)} · {a.durationMin} min ·{" "}
                    {a.questionCount} Qs · {displayDifficulty(a.difficulty)} ·{" "}
                    {attemptStatusLabel(a.attemptStatus)}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition" />
              </Link>
            ))}
            {!upcoming.length && (
              <p className="text-sm text-muted-foreground py-4">
                No published assessments yet.
              </p>
            )}
          </div>
        </div>

        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Upcoming Interviews</h3>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground py-4">
              No interviews scheduled yet. Interview scheduling is not available
              in this release.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
