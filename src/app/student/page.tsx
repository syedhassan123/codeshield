import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  displayDifficulty,
  displayType,
  serializeAssessment,
} from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { ActivityAreaChart } from "@/components/charts/simple-charts";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { mockInterviews, mockNotifications } from "@/lib/mock-data";

export default async function StudentDashboardPage() {
  const session = await auth();
  const first = session?.user?.name?.split(" ")[0] || "there";
  console.log("Logged in user:", session)

  let upcoming: ReturnType<typeof serializeAssessment>[] = [];
  try {
    await connectDB();
    const studentId = new mongoose.Types.ObjectId(session!.user.id);
    const docs = await Assessment.find({
      status: "published",
      $or: [
        { visibility: "all" },
        { visibility: "assigned", assignedStudentIds: studentId },
      ],
    })
      .sort({ publishedAt: -1 })
      .limit(4);
    upcoming = docs.map((doc) =>
      serializeAssessment(doc, {
        questionCount: doc.questionIds?.length ?? 0,
      }),
    );
  } catch {
    upcoming = [];
  }

  return (
    <div>
      <PageHeader
        title={`Hi ${first} 👋`}
        description="Ready for your next challenge? Let's keep the streak going."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Assessments Taken" value="14" />
        <StatCard label="Coding Solved" value="42" />
        <StatCard label="Interviews" value="3" />
        <StatCard label="Certificates" value="5" />
      </div>

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="card-soft p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold">Performance Trend</h3>
            <span className="text-xs font-semibold text-success">+12%</span>
          </div>
          <ActivityAreaChart />
        </div>
        <div className="card-soft p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-display font-bold">Notifications</h3>
          </div>
          <div className="space-y-2">
            {mockNotifications.map((n) => (
              <div
                key={n.text}
                className="flex gap-3 items-start p-2 rounded-lg hover:bg-muted/40"
              >
                <span className="text-primary mt-1">•</span>
                <div>
                  <div className="text-sm font-semibold">{n.text}</div>
                  <div className="text-[11px] text-muted-foreground">{n.time}</div>
                </div>
              </div>
            ))}
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
                href={`/student/exam/${a.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-xs font-bold">
                  {displayDifficulty(a.difficulty)[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {displayType(a.type)} · {a.durationMin} min ·{" "}
                    {a.questionCount} Qs · {displayDifficulty(a.difficulty)}
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
            {mockInterviews.slice(0, 4).map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-border"
              >
                <div className="w-10 h-10 rounded-xl bg-success-soft text-success flex items-center justify-center text-xs font-bold">
                  {i.type[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{i.role}</div>
                  <div className="text-[11px] text-muted-foreground">
                    with {i.interviewer} · {i.date}
                  </div>
                </div>
                <span className="text-xs font-semibold">{i.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
