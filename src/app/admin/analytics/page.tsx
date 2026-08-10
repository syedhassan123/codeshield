import {
  ActivityAreaChart,
  GrowthBarChart,
  LanguageBarChart,
} from "@/components/charts/simple-charts";
import { PageHeader } from "@/components/ui/page-header";

export default function AdminAnalyticsPage() {
  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Detailed performance and security insights."
      />

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="card-soft p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Performance Trend</h3>
            <span className="text-xs text-muted-foreground">Weekly</span>
          </div>
          <ActivityAreaChart />
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Skill Distribution</h3>
          <LanguageBarChart />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">User Growth</h3>
          <GrowthBarChart />
          <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
            <span>• students</span>
            <span>• interviewers</span>
          </div>
        </div>
        <div className="card-soft p-5">
          <h3 className="font-display font-bold mb-4">Coding Language Mix</h3>
          <LanguageBarChart />
        </div>
      </div>

      <div className="card-soft p-5">
        <h3 className="font-display font-bold mb-4">Security Trend</h3>
        <ActivityAreaChart />
      </div>
    </div>
  );
}
