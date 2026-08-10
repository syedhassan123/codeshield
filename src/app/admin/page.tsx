import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  displayDifficulty,
  displayStatus,
  displayType,
  serializeAssessment,
} from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import {
  ActivityAreaChart,
  GrowthBarChart,
  LanguageBarChart,
  SecurityDonut,
} from "@/components/charts/simple-charts";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { mockAlerts } from "@/lib/mock-data";

export default async function AdminDashboardPage() {
  const session = await auth();
  const firstName = session?.user?.name?.split(" ")[0] || "Admin";

  let recentAssessments: ReturnType<typeof serializeAssessment>[] = [];
  try {
    await connectDB();
    const docs = await Assessment.find().sort({ updatedAt: -1 }).limit(7);
    recentAssessments = docs.map((doc) =>
      serializeAssessment(doc, {
        questionCount: doc.questionIds?.length ?? 0,
      }),
    );
  } catch {
    recentAssessments = [];
  }

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${session?.user?.name?.split(" ").slice(0, 2).join(" ") || firstName} 👋`}
        description="Here's what's happening across CodeShield today."
        actions={
          <>
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4" /> Export
            </Button>
            <Button asChild size="sm">
              <Link href="/admin/assessments">
                <Plus className="w-4 h-4" /> New Assessment
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Students" value="5,240" delta="12 %" />
        <StatCard label="Active Assessments" value="38" delta="8 %" />
        <StatCard label="Scheduled Interviews" value="142" delta="5 %" />
        <StatCard label="AI Alerts (24h)" value="87" delta="3 %" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Completed Assessments" value="12,384" />
        <StatCard label="Completed Interviews" value="1,820" />
        <StatCard label="Suspicious Activities" value="24" />
        <StatCard label="System Status" value="Operational" tone="success" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Assessment & Interview Activity</h3>
            <span className="text-xs text-muted-foreground">Last 7 days</span>
          </div>
          <ActivityAreaChart />
        </div>
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Security Status</h3>
            <span className="text-xs font-semibold text-success">Live</span>
          </div>
          <SecurityDonut />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="card-soft p-5 lg:col-span-2">
          <h3 className="font-display font-bold mb-4">User Growth</h3>
          <GrowthBarChart />
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Coding Languages</h3>
          <LanguageBarChart />
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Recent AI Alerts</h3>
            <span className="text-xs font-semibold text-primary">18 new</span>
          </div>
          <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
            {mockAlerts.slice(0, 6).map((a, i) => (
              <div
                key={`${a.student}-${i}`}
                className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/50"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-danger mt-1.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold truncate">{a.type}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {a.student} · {a.assessment}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground">{a.time}</div>
              </div>
            ))}
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
              {recentAssessments.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                  <td className="py-3 px-2 font-medium">{a.title}</td>
                  <td className="py-3 px-2">{displayType(a.type)}</td>
                  <td className="py-3 px-2">{displayDifficulty(a.difficulty)}</td>
                  <td className="py-3 px-2">{a.questionCount}</td>
                  <td className="py-3 px-2">{a.totalMarks}</td>
                  <td className="py-3 px-2">{displayStatus(a.status)}</td>
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
