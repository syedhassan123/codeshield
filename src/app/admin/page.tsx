import Link from "next/link";
import { Plus } from "lucide-react";
import {
  ActivityAreaChart,
  GrowthBarChart,
  LanguageBarChart,
  SecurityDonut,
} from "@/components/charts/simple-charts";
import { DashboardSection } from "@/components/ui/dashboard-section";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import {
  getAdminDashboardStats,
  getAttemptActivityChart,
  getCodingLanguageChart,
  getRecentSecurityAlerts,
  getSecurityStatusChart,
  getUserGrowthChart,
  type AdminDashboardStats,
} from "@/lib/admin/queries";
import { connectDB } from "@/lib/db";
import { requirePageRole } from "@/lib/safe-auth";
import {
  displayDifficulty,
  displayStatus,
  displayType,
  serializeAssessment,
} from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { cn } from "@/lib/utils";

function assessmentStatusVariant(status: string) {
  switch (status) {
    case "published":
      return "success" as const;
    case "draft":
      return "muted" as const;
    case "scheduled":
      return "primary" as const;
    default:
      return "default" as const;
  }
}

export default async function AdminDashboardPage() {
  const session = await requirePageRole(["admin"]);
  const firstName = session.user.name?.split(" ")[0] || "Admin";

  let recentAssessments: ReturnType<typeof serializeAssessment>[] = [];
  let stats: AdminDashboardStats = {
    totalStudents: 0,
    activeAssessments: 0,
    activeAttempts: 0,
    securityEvents24h: 0,
    completedAttempts: 0,
    completedEvaluations: 0,
    pendingEvaluations: 0,
    violationEvents: 0,
    systemStatus: "Operational",
  };
  let activityData: Awaited<ReturnType<typeof getAttemptActivityChart>> = [];
  let growthData: Awaited<ReturnType<typeof getUserGrowthChart>> = [];
  let languageData: Awaited<ReturnType<typeof getCodingLanguageChart>> = [];
  let securitySegments: Awaited<ReturnType<typeof getSecurityStatusChart>> = [];
  let recentAlerts: Awaited<ReturnType<typeof getRecentSecurityAlerts>> = [];

  try {
    await connectDB();
    const [
      assessmentDocs,
      dashboardStats,
      activity,
      growth,
      languages,
      security,
      alerts,
    ] = await Promise.all([
      Assessment.find().sort({ updatedAt: -1 }).limit(7),
      getAdminDashboardStats(),
      getAttemptActivityChart(),
      getUserGrowthChart(),
      getCodingLanguageChart(),
      getSecurityStatusChart(),
      getRecentSecurityAlerts(6),
    ]);

    recentAssessments = assessmentDocs.map((doc) =>
      serializeAssessment(doc, {
        questionCount: doc.questionIds?.length ?? 0,
      }),
    );
    stats = dashboardStats;
    activityData = activity;
    growthData = growth;
    languageData = languages;
    securitySegments = security;
    recentAlerts = alerts;
  } catch {
    recentAssessments = [];
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        title={`Welcome back, ${session.user.name?.split(" ").slice(0, 2).join(" ") || firstName} 👋`}
        description="Here's what's happening across CodeShield today."
        actions={
          <Button asChild size="sm" className="shadow-soft">
            <Link href="/admin/assessments">
              <Plus className="w-4 h-4" /> New Assessment
            </Link>
          </Button>
        }
      />

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
          Operations overview
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Students"
            value={stats.totalStudents.toLocaleString()}
            emphasis
          />
          <StatCard
            label="Active Assessments"
            value={stats.activeAssessments.toLocaleString()}
            emphasis
          />
          <StatCard
            label="Pending Evaluations"
            value={stats.pendingEvaluations.toLocaleString()}
            emphasis
          />
          <StatCard
            label="Security Events (24h)"
            value={stats.securityEvents24h.toLocaleString()}
            emphasis
          />
        </div>
      </div>

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
          Platform metrics
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Completed Attempts"
            value={stats.completedAttempts.toLocaleString()}
          />
          <StatCard
            label="Evaluations Completed"
            value={stats.completedEvaluations.toLocaleString()}
          />
          <StatCard
            label="Violation Events"
            value={stats.violationEvents.toLocaleString()}
            tone="warning"
          />
          <StatCard
            label="System Status"
            value={stats.systemStatus}
            tone="success"
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
        <DashboardSection
          className="lg:col-span-2"
          title="Assessment Activity"
          meta="Last 7 days"
        >
          <ActivityAreaChart data={activityData} height="md" />
        </DashboardSection>

        <DashboardSection
          title="Security Status"
          meta={
            <span className="inline-flex items-center gap-1.5 text-success font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              Live
            </span>
          }
          bodyClassName="min-h-[13rem] flex flex-col justify-center"
        >
          <SecurityDonut segments={securitySegments} />
        </DashboardSection>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
        <DashboardSection className="lg:col-span-2" title="User Growth">
          <GrowthBarChart data={growthData} height="md" />
        </DashboardSection>

        <DashboardSection title="Coding Languages">
          <LanguageBarChart data={languageData} height="sm" />
        </DashboardSection>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
        <DashboardSection
          title="Recent Security Alerts"
          meta={`${recentAlerts.length} recent`}
          bodyClassName="max-h-56 overflow-y-auto"
        >
          {recentAlerts.length ? (
            <ul className="divide-y divide-border">
              {recentAlerts.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-1 px-1 rounded-lg transition-colors"
                >
                  <span
                    className={cn(
                      "w-2 h-2 rounded-full mt-1.5 shrink-0",
                      alert.severity === "high"
                        ? "bg-danger"
                        : alert.severity === "medium"
                          ? "bg-warning"
                          : "bg-muted-foreground/60",
                    )}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">
                      {alert.type}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {alert.student} · {alert.assessment}
                    </p>
                  </div>
                  <time className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {alert.time}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No security events recorded yet.
            </p>
          )}
        </DashboardSection>

        <DashboardSection
          className="lg:col-span-2 overflow-hidden"
          title="Recent Assessments"
          action={
            <Link
              href="/admin/assessments"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View all →
            </Link>
          }
        >
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm min-w-[540px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                  <th className="text-left py-2 px-2 font-semibold">Title</th>
                  <th className="text-left py-2 px-2 font-semibold">Type</th>
                  <th className="text-left py-2 px-2 font-semibold hidden sm:table-cell">
                    Difficulty
                  </th>
                  <th className="text-left py-2 px-2 font-semibold">Qs</th>
                  <th className="text-left py-2 px-2 font-semibold hidden md:table-cell">
                    Marks
                  </th>
                  <th className="text-left py-2 px-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAssessments.map((assessment) => (
                  <tr
                    key={assessment.id}
                    className="border-b border-border last:border-0 hover:bg-muted/25 transition-colors"
                  >
                    <td className="py-2.5 px-2 font-medium max-w-[180px] truncate">
                      {assessment.title}
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">
                      {displayType(assessment.type)}
                    </td>
                    <td className="py-2.5 px-2 hidden sm:table-cell text-muted-foreground">
                      {displayDifficulty(assessment.difficulty)}
                    </td>
                    <td className="py-2.5 px-2 tabular-nums">
                      {assessment.questionCount}
                    </td>
                    <td className="py-2.5 px-2 hidden md:table-cell tabular-nums">
                      {assessment.totalMarks}
                    </td>
                    <td className="py-2.5 px-2">
                      <StatusBadge
                        variant={assessmentStatusVariant(assessment.status)}
                      >
                        {displayStatus(assessment.status)}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
                {!recentAssessments.length && (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No assessments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </DashboardSection>
      </div>
    </div>
  );
}
