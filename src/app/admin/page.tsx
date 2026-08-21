import Link from "next/link";
import { Plus } from "lucide-react";
import {
  ActivityAreaChart,
  GrowthBarChart,
  LanguageBarChart,
  SecurityDonut,
} from "@/components/charts/simple-charts";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
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
    <div>
      <PageHeader
        title={`Welcome back, ${session.user.name?.split(" ").slice(0, 2).join(" ") || firstName} 👋`}
        description="Here's what's happening across CodeShield today."
        actions={
          <Button asChild size="sm">
            <Link href="/admin/assessments">
              <Plus className="w-4 h-4" /> New Assessment
            </Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Students" value={stats.totalStudents.toLocaleString()} />
        <StatCard label="Active Assessments" value={stats.activeAssessments.toLocaleString()} />
        <StatCard label="Pending Evaluations" value={stats.pendingEvaluations.toLocaleString()} />
        <StatCard label="Security Events (24h)" value={stats.securityEvents24h.toLocaleString()} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Completed Attempts" value={stats.completedAttempts.toLocaleString()} />
        <StatCard label="Evaluations Completed" value={stats.completedEvaluations.toLocaleString()} />
        <StatCard label="Violation Events" value={stats.violationEvents.toLocaleString()} tone="warning" />
        <StatCard label="System Status" value={stats.systemStatus} tone="success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Assessment Activity</h3>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <ActivityAreaChart data={activityData} />
        </div>
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Security Status</h3>
            <span className="text-xs font-semibold text-success">Live</span>
          </div>
          <SecurityDonut segments={securitySegments} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="card-soft p-5 lg:col-span-2">
          <h3 className="font-display font-bold mb-4">User Growth</h3>
          <GrowthBarChart data={growthData} />
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Coding Languages</h3>
          <LanguageBarChart data={languageData} />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Recent Security Alerts</h3>
            <span className="text-xs font-semibold text-primary">
              {recentAlerts.length} recent
            </span>
          </div>
          <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-danger mt-1.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{alert.type}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {alert.student} · {alert.assessment}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">{alert.time}</div>
              </div>
            ))}
            {!recentAlerts.length && (
              <div className="text-sm text-muted-foreground py-6 text-center">
                No security events recorded yet.
              </div>
            )}
          </div>
        </div>

        <div className="card-soft p-5 lg:col-span-2 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Recent Assessments</h3>
            <Link href="/admin/assessments" className="text-xs font-semibold text-primary">
              View all →
            </Link>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
                <th className="text-left py-2 px-2">Title</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-left py-2 px-2">Difficulty</th>
                <th className="text-left py-2 px-2">Questions</th>
                <th className="text-left py-2 px-2">Marks</th>
                <th className="text-left py-2 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentAssessments.map((assessment) => (
                <tr key={assessment.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-2 font-medium">{assessment.title}</td>
                  <td className="py-3 px-2">{displayType(assessment.type)}</td>
                  <td className="py-3 px-2">{displayDifficulty(assessment.difficulty)}</td>
                  <td className="py-3 px-2">{assessment.questionCount}</td>
                  <td className="py-3 px-2">{assessment.totalMarks}</td>
                  <td className="py-3 px-2">{displayStatus(assessment.status)}</td>
                </tr>
              ))}
              {!recentAssessments.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-muted-foreground">
                    No assessments yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
