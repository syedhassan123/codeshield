import {
  ActivityAreaChart,
  GrowthBarChart,
  LanguageBarChart,
  ScoreBarList,
} from "@/components/charts/simple-charts";
import { PageHeader } from "@/components/ui/page-header";
import {
  getCodingLanguageChart,
  getSecurityEventTrendChart,
  getSkillDistributionChart,
  getUserGrowthChart,
  getWeeklyPerformanceChart,
  type ChartPoint,
  type GrowthPoint,
} from "@/lib/admin/queries";
import { connectDB } from "@/lib/db";
import { requirePageRole } from "@/lib/safe-auth";

export default async function AdminAnalyticsPage() {
  await requirePageRole(["admin"]);

  let performance: ChartPoint[] = [];
  let skills: ChartPoint[] = [];
  let growth: GrowthPoint[] = [];
  let languages: ChartPoint[] = [];
  let security: ChartPoint[] = [];

  try {
    await connectDB();
    [performance, skills, growth, languages, security] = await Promise.all([
      getWeeklyPerformanceChart(),
      getSkillDistributionChart(),
      getUserGrowthChart(),
      getCodingLanguageChart(),
      getSecurityEventTrendChart(),
    ]);
  } catch {
    performance = [];
    skills = [];
    growth = [];
    languages = [];
    security = [];
  }

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Completed-result scores, assessment averages, user growth, and security violations."
      />

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Performance Trend</h3>
            <span className="text-xs text-muted-foreground">
              Avg score · last 8 weeks
            </span>
          </div>
          <ActivityAreaChart
            data={performance}
            seriesName="Avg score"
            emptyLabel="No completed results in the last 8 weeks."
          />
        </div>
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Skill Distribution</h3>
            <span className="text-xs text-muted-foreground">
              Avg score by assessment
            </span>
          </div>
          <ScoreBarList data={skills} />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">User Growth</h3>
            <span className="text-xs text-muted-foreground">Last 8 months</span>
          </div>
          <GrowthBarChart data={growth} />
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>• students</span>
            <span>• interviewers</span>
          </div>
        </div>
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Coding Language Mix</h3>
            <span className="text-xs text-muted-foreground">
              Finalized submissions
            </span>
          </div>
          <LanguageBarChart data={languages} height="md" />
        </div>
      </div>

      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold">Security Trend</h3>
          <span className="text-xs text-muted-foreground">
            Violations · last 7 days
          </span>
        </div>
        <ActivityAreaChart
          data={security}
          seriesName="Violations"
          emptyLabel="No security violations in the last 7 days."
        />
      </div>
    </div>
  );
}
