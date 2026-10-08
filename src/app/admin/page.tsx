// import Link from "next/link";
// import { Plus } from "lucide-react";
// import {
//   ActivityAreaChart,
//   GrowthBarChart,
//   LanguageBarChart,
//   SecurityDonut,
// } from "@/components/charts/simple-charts";
// import { DashboardSection } from "@/components/ui/dashboard-section";
// import { PageHeader } from "@/components/ui/page-header";
// import { StatCard } from "@/components/ui/stat-card";
// import { StatusBadge } from "@/components/ui/status-badge";
// import { Button } from "@/components/ui/button";
// import {
//   getAdminDashboardStats,
//   getAttemptActivityChart,
//   getCodingLanguageChart,
//   getRecentSecurityAlerts,
//   getSecurityStatusChart,
//   getUserGrowthChart,
//   type AdminDashboardStats,
// } from "@/lib/admin/queries";
// import { connectDB } from "@/lib/db";
// import { requirePageRole } from "@/lib/safe-auth";
// import {
//   displayDifficulty,
//   displayStatus,
//   displayType,
//   serializeAssessment,
// } from "@/lib/serializers";
// import { Assessment } from "@/models/Assessment";
// import { cn } from "@/lib/utils";

// function assessmentStatusVariant(status: string) {
//   switch (status) {
//     case "published":
//       return "success" as const;
//     case "draft":
//       return "muted" as const;
//     case "scheduled":
//       return "primary" as const;
//     default:
//       return "default" as const;
//   }
// }

// export default async function AdminDashboardPage() {
//   const session = await requirePageRole(["admin"]);
//   const firstName = session.user.name?.split(" ")[0] || "Admin";

//   let recentAssessments: ReturnType<typeof serializeAssessment>[] = [];
//   let stats: AdminDashboardStats = {
//     totalStudents: 0,
//     activeAssessments: 0,
//     activeAttempts: 0,
//     securityEvents24h: 0,
//     completedAttempts: 0,
//     completedEvaluations: 0,
//     pendingEvaluations: 0,
//     violationEvents: 0,
//     systemStatus: "Operational",
//   };
//   let activityData: Awaited<ReturnType<typeof getAttemptActivityChart>> = [];
//   let growthData: Awaited<ReturnType<typeof getUserGrowthChart>> = [];
//   let languageData: Awaited<ReturnType<typeof getCodingLanguageChart>> = [];
//   let securitySegments: Awaited<ReturnType<typeof getSecurityStatusChart>> = [];
//   let recentAlerts: Awaited<ReturnType<typeof getRecentSecurityAlerts>> = [];

//   try {
//     await connectDB();
//     const [
//       assessmentDocs,
//       dashboardStats,
//       activity,
//       growth,
//       languages,
//       security,
//       alerts,
//     ] = await Promise.all([
//       Assessment.find().sort({ updatedAt: -1 }).limit(7),
//       getAdminDashboardStats(),
//       getAttemptActivityChart(),
//       getUserGrowthChart(),
//       getCodingLanguageChart(),
//       getSecurityStatusChart(),
//       getRecentSecurityAlerts(6),
//     ]);

//     recentAssessments = assessmentDocs.map((doc) =>
//       serializeAssessment(doc, {
//         questionCount: doc.questionIds?.length ?? 0,
//       }),
//     );
//     stats = dashboardStats;
//     activityData = activity;
//     growthData = growth;
//     languageData = languages;
//     securitySegments = security;
//     recentAlerts = alerts;
//   } catch {
//     recentAssessments = [];
//   }

//   return (
//     <div className="space-y-5 sm:space-y-6">
//       <PageHeader
//         title={`Welcome back, ${session.user.name?.split(" ").slice(0, 2).join(" ") || firstName} 👋`}
//         description="Here's what's happening across CodeShield today."
//         actions={
//           <Button asChild size="sm" className="shadow-soft">
//             <Link href="/admin/assessments">
//               <Plus className="w-4 h-4" /> New Assessment
//             </Link>
//           </Button>
//         }
//       />

//       <div>
//         <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
//           Operations overview
//         </p>
//         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
//           <StatCard
//             label="Total Students"
//             value={stats.totalStudents.toLocaleString()}
//             emphasis
//           />
//           <StatCard
//             label="Active Assessments"
//             value={stats.activeAssessments.toLocaleString()}
//             emphasis
//           />
//           <StatCard
//             label="Pending Evaluations"
//             value={stats.pendingEvaluations.toLocaleString()}
//             emphasis
//           />
//           <StatCard
//             label="Security Events (24h)"
//             value={stats.securityEvents24h.toLocaleString()}
//             emphasis
//           />
//         </div>
//       </div>

//       <div>
//         <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 px-0.5">
//           Platform metrics
//         </p>
//         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
//           <StatCard
//             label="Completed Attempts"
//             value={stats.completedAttempts.toLocaleString()}
//           />
//           <StatCard
//             label="Evaluations Completed"
//             value={stats.completedEvaluations.toLocaleString()}
//           />
//           <StatCard
//             label="Violation Events"
//             value={stats.violationEvents.toLocaleString()}
//             tone="warning"
//           />
//           <StatCard
//             label="System Status"
//             value={stats.systemStatus}
//             tone="success"
//           />
//         </div>
//       </div>

//       <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
//         <DashboardSection
//           className="lg:col-span-2"
//           title="Assessment Activity"
//           meta="Last 7 days"
//         >
//           <ActivityAreaChart data={activityData} height="md" />
//         </DashboardSection>

//         <DashboardSection
//           title="Security Status"
//           meta={
//             <span className="inline-flex items-center gap-1.5 text-success font-semibold">
//               <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
//               Live
//             </span>
//           }
//           bodyClassName="min-h-[13rem] flex flex-col justify-center"
//         >
//           <SecurityDonut segments={securitySegments} />
//         </DashboardSection>
//       </div>

//       <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
//         <DashboardSection className="lg:col-span-2" title="User Growth">
//           <GrowthBarChart data={growthData} height="md" />
//         </DashboardSection>

//         <DashboardSection title="Coding Languages">
//           <LanguageBarChart data={languageData} height="sm" />
//         </DashboardSection>
//       </div>

//       <div className="grid lg:grid-cols-3 gap-4 sm:gap-5">
//         <DashboardSection
//           title="Recent Security Alerts"
//           meta={`${recentAlerts.length} recent`}
//           bodyClassName="max-h-56 overflow-y-auto"
//         >
//           {recentAlerts.length ? (
//             <ul className="divide-y divide-border">
//               {recentAlerts.map((alert) => (
//                 <li
//                   key={alert.id}
//                   className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-muted/30 -mx-1 px-1 rounded-lg transition-colors"
//                 >
//                   <span
//                     className={cn(
//                       "w-2 h-2 rounded-full mt-1.5 shrink-0",
//                       alert.severity === "high"
//                         ? "bg-danger"
//                         : alert.severity === "medium"
//                           ? "bg-warning"
//                           : "bg-muted-foreground/60",
//                     )}
//                     aria-hidden
//                   />
//                   <div className="min-w-0 flex-1">
//                     <p className="text-sm font-semibold leading-snug">
//                       {alert.type}
//                     </p>
//                     <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
//                       {alert.student} · {alert.assessment}
//                     </p>
//                   </div>
//                   <time className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
//                     {alert.time}
//                   </time>
//                 </li>
//               ))}
//             </ul>
//           ) : (
//             <p className="text-sm text-muted-foreground py-8 text-center">
//               No security events recorded yet.
//             </p>
//           )}
//         </DashboardSection>

//         <DashboardSection
//           className="lg:col-span-2 overflow-hidden"
//           title="Recent Assessments"
//           action={
//             <Link
//               href="/admin/assessments"
//               className="text-xs font-semibold text-primary hover:underline"
//             >
//               View all →
//             </Link>
//           }
//         >
//           <div className="overflow-x-auto -mx-1">
//             <table className="w-full text-sm min-w-[540px]">
//               <thead>
//                 <tr className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
//                   <th className="text-left py-2 px-2 font-semibold">Title</th>
//                   <th className="text-left py-2 px-2 font-semibold">Type</th>
//                   <th className="text-left py-2 px-2 font-semibold hidden sm:table-cell">
//                     Difficulty
//                   </th>
//                   <th className="text-left py-2 px-2 font-semibold">Qs</th>
//                   <th className="text-left py-2 px-2 font-semibold hidden md:table-cell">
//                     Marks
//                   </th>
//                   <th className="text-left py-2 px-2 font-semibold">Status</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {recentAssessments.map((assessment) => (
//                   <tr
//                     key={assessment.id}
//                     className="border-b border-border last:border-0 hover:bg-muted/25 transition-colors"
//                   >
//                     <td className="py-2.5 px-2 font-medium max-w-[180px] truncate">
//                       {assessment.title}
//                     </td>
//                     <td className="py-2.5 px-2 text-muted-foreground whitespace-nowrap">
//                       {displayType(assessment.type)}
//                     </td>
//                     <td className="py-2.5 px-2 hidden sm:table-cell text-muted-foreground">
//                       {displayDifficulty(assessment.difficulty)}
//                     </td>
//                     <td className="py-2.5 px-2 tabular-nums">
//                       {assessment.questionCount}
//                     </td>
//                     <td className="py-2.5 px-2 hidden md:table-cell tabular-nums">
//                       {assessment.totalMarks}
//                     </td>
//                     <td className="py-2.5 px-2">
//                       <StatusBadge
//                         variant={assessmentStatusVariant(assessment.status)}
//                       >
//                         {displayStatus(assessment.status)}
//                       </StatusBadge>
//                     </td>
//                   </tr>
//                 ))}
//                 {!recentAssessments.length && (
//                   <tr>
//                     <td
//                       colSpan={6}
//                       className="py-8 text-center text-muted-foreground"
//                     >
//                       No assessments yet.
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </DashboardSection>
//       </div>
//     </div>
//   );
// }








import Link from "next/link";
import {
  ArrowRight,
  CheckCheck,
  ClipboardList,
  Hourglass,
  ListChecks,
  Plus,
  Server,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Users,
} from "lucide-react";
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

/**
 * Page-scoped motion, kept here so the revamp is drop-in (no tailwind.config or
 * globals.css changes). One choreographed load sequence, plus slow ambient drift.
 * Everything is switched off for people who prefer reduced motion.
 */
const MOTION_CSS = `
@keyframes cs-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes cs-drift{0%,100%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(0,-20px,0) scale(1.06)}}
.cs-seq>*{animation:cs-rise .6s cubic-bezier(.22,1,.36,1) backwards;animation-delay:var(--cs-d,0s)}
.cs-seq>*:nth-child(2){animation-delay:calc(var(--cs-d,0s) + .06s)}
.cs-seq>*:nth-child(3){animation-delay:calc(var(--cs-d,0s) + .12s)}
.cs-seq>*:nth-child(4){animation-delay:calc(var(--cs-d,0s) + .18s)}
.cs-d1{--cs-d:.08s}.cs-d2{--cs-d:.2s}.cs-d3{--cs-d:.32s}.cs-d4{--cs-d:.44s}.cs-d5{--cs-d:.56s}
.cs-drift{animation:cs-drift 18s ease-in-out infinite}
.cs-drift:nth-child(2){animation-delay:-7s}
.cs-drift:nth-child(3){animation-delay:-12s}
@media (prefers-reduced-motion:reduce){.cs-seq>*,.cs-drift{animation:none}}
`;

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center gap-3 px-0.5">
      <p className="text-xs font-medium text-muted-foreground">{children}</p>
      <span
        aria-hidden
        className="h-px flex-1 bg-gradient-to-r from-border to-transparent"
      />
    </div>
  );
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
    <div className="relative isolate">
      <style dangerouslySetInnerHTML={{ __html: MOTION_CSS }} />

      {/* Ambient light — gives the glass surfaces something to refract */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-12 -z-10 h-[460px]"
      >
        <div className="cs-drift absolute left-[4%] top-0 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="cs-drift absolute right-[6%] top-10 h-72 w-72 rounded-full bg-[#2e83fb]/20 blur-3xl" />
        <div className="cs-drift absolute left-[42%] top-44 h-52 w-52 rounded-full bg-[#8b5cf6]/10 blur-3xl" />
      </div>

      <div className="space-y-5 sm:space-y-6">
        <PageHeader
          title={`Welcome back, ${session.user.name?.split(" ").slice(0, 2).join(" ") || firstName} 👋`}
          description="Here's what's happening across CodeShield today."
          actions={
            <Button
              asChild
              size="sm"
              className="group relative overflow-hidden rounded-xl bg-gradient-to-r from-primary to-[#2e83fb] px-4 text-white ring-1 ring-white/25 shadow-[0_8px_24px_-8px_rgba(79,85,243,0.65)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-10px_rgba(79,85,243,0.8)] focus-visible:ring-4 focus-visible:ring-primary/30 active:translate-y-0 active:scale-[0.98] motion-reduce:transition-none"
            >
              <Link href="/admin/assessments">
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -left-full w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-[450%] motion-reduce:hidden"
                />
                <Plus
                  className="relative h-4 w-4 transition-transform duration-300 group-hover:rotate-90"
                  aria-hidden
                />
                <span className="relative">New Assessment</span>
              </Link>
            </Button>
          }
        />

        <div>
          <GroupLabel>Operations overview</GroupLabel>
          <div className="cs-seq cs-d1 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Students"
              value={stats.totalStudents.toLocaleString()}
              icon={Users}
              emphasis
            />
            <StatCard
              label="Active Assessments"
              value={stats.activeAssessments.toLocaleString()}
              icon={ClipboardList}
              emphasis
            />
            <StatCard
              label="Pending Evaluations"
              value={stats.pendingEvaluations.toLocaleString()}
              icon={Hourglass}
              emphasis
            />
            <StatCard
              label="Security Events (24h)"
              value={stats.securityEvents24h.toLocaleString()}
              icon={ShieldAlert}
              emphasis
            />
          </div>
        </div>

        <div>
          <GroupLabel>Platform metrics</GroupLabel>
          <div className="cs-seq cs-d2 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatCard
              label="Completed Attempts"
              value={stats.completedAttempts.toLocaleString()}
              icon={ListChecks}
            />
            <StatCard
              label="Evaluations Completed"
              value={stats.completedEvaluations.toLocaleString()}
              icon={CheckCheck}
            />
            <StatCard
              label="Violation Events"
              value={stats.violationEvents.toLocaleString()}
              tone="warning"
              icon={Siren}
            />
            <StatCard
              label="System Status"
              value={stats.systemStatus}
              tone="success"
              icon={Server}
            />
          </div>
        </div>

        <div className="cs-seq cs-d3 grid gap-4 sm:gap-5 lg:grid-cols-3">
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
              <span className="inline-flex items-center gap-1.5 font-semibold text-success">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60 motion-reduce:animate-none" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Live
              </span>
            }
            bodyClassName="min-h-[13rem] flex flex-col justify-center"
          >
            <SecurityDonut segments={securitySegments} />
          </DashboardSection>
        </div>

        <div className="cs-seq cs-d4 grid gap-4 sm:gap-5 lg:grid-cols-3">
          <DashboardSection className="lg:col-span-2" title="User Growth">
            <GrowthBarChart data={growthData} height="md" />
          </DashboardSection>

          <DashboardSection title="Coding Languages">
            <LanguageBarChart data={languageData} height="sm" />
          </DashboardSection>
        </div>

        <div className="cs-seq cs-d5 grid gap-4 sm:gap-5 lg:grid-cols-3">
          <DashboardSection
            title="Recent Security Alerts"
            meta={`${recentAlerts.length} recent`}
            bodyClassName="max-h-56 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
          >
            {recentAlerts.length ? (
              <ul className="divide-y divide-border/50">
                {recentAlerts.map((alert) => (
                  <li
                    key={alert.id}
                    className="group/alert -mx-1 flex items-start gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 hover:bg-primary/[0.045]"
                  >
                    <span
                      className={cn(
                        "relative mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1 transition-transform duration-300 group-hover/alert:scale-110 motion-reduce:transition-none",
                        alert.severity === "high"
                          ? "bg-danger-soft text-danger ring-danger/20"
                          : alert.severity === "medium"
                            ? "bg-warning-soft text-warning ring-warning/20"
                            : "bg-muted text-muted-foreground ring-border",
                      )}
                      aria-hidden
                    >
                      {alert.severity === "high" && (
                        <span className="absolute -inset-0.5 animate-pulse rounded-[10px] ring-2 ring-danger/40 motion-reduce:animate-none" />
                      )}
                      <ShieldAlert className="relative h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug text-foreground">
                        {alert.type}
                        <span className="sr-only"> — {alert.severity} severity</span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        {alert.student} · {alert.assessment}
                      </p>
                    </div>
                    <time className="mt-0.5 shrink-0 rounded-full bg-muted/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
                      {alert.time}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-success-soft text-success ring-1 ring-success/20">
                  <span
                    aria-hidden
                    className="absolute inset-0 animate-pulse rounded-2xl bg-success/10 motion-reduce:animate-none"
                  />
                  <ShieldCheck className="relative h-5 w-5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground/80">
                    No security events recorded yet.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Flagged activity during assessments will show up here.
                  </p>
                </div>
              </div>
            )}
          </DashboardSection>

          <DashboardSection
            className="lg:col-span-2 overflow-hidden"
            title="Recent Assessments"
            action={
              <Link
                href="/admin/assessments"
                className="group/link inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary transition-all duration-200 hover:border-primary/30 hover:shadow-[0_6px_16px_-8px_rgba(79,85,243,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                View all
                <ArrowRight
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover/link:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            }
          >
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full min-w-[540px] text-sm">
                <thead>
                  <tr className="border-b border-border/70 text-[11px] font-medium text-muted-foreground">
                    <th className="px-2 py-2.5 text-left font-medium">Title</th>
                    <th className="px-2 py-2.5 text-left font-medium">Type</th>
                    <th className="hidden px-2 py-2.5 text-left font-medium sm:table-cell">
                      Difficulty
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">Qs</th>
                    <th className="hidden px-2 py-2.5 text-left font-medium md:table-cell">
                      Marks
                    </th>
                    <th className="px-2 py-2.5 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAssessments.map((assessment) => (
                    <tr
                      key={assessment.id}
                      className="group/row border-b border-border/50 transition-colors duration-200 last:border-0 hover:bg-primary/[0.04]"
                    >
                      <td
                        className="relative max-w-[180px] truncate px-2 py-3 font-medium text-foreground"
                        title={assessment.title}
                      >
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-gradient-to-b from-primary to-[#2e83fb] opacity-0 transition-opacity duration-200 group-hover/row:opacity-100"
                        />
                        {assessment.title}
                      </td>
                      <td className="whitespace-nowrap px-2 py-3">
                        <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-xs font-medium text-foreground/80">
                          {displayType(assessment.type)}
                        </span>
                      </td>
                      <td className="hidden px-2 py-3 text-muted-foreground sm:table-cell">
                        {displayDifficulty(assessment.difficulty)}
                      </td>
                      <td className="px-2 py-3 font-medium tabular-nums">
                        {assessment.questionCount}
                      </td>
                      <td className="hidden px-2 py-3 font-medium tabular-nums md:table-cell">
                        {assessment.totalMarks}
                      </td>
                      <td className="px-2 py-3">
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
                      <td colSpan={6} className="px-2 py-10">
                        <div className="flex flex-col items-center gap-3 text-center">
                          <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary ring-1 ring-primary/20">
                            <span
                              aria-hidden
                              className="absolute inset-0 animate-pulse rounded-2xl bg-primary/10 motion-reduce:animate-none"
                            />
                            <ClipboardList className="relative h-5 w-5" aria-hidden />
                          </span>
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground/80">
                              No assessments yet.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Create your first assessment and it will be listed here.
                            </p>
                          </div>
                          <Link
                            href="/admin/assessments"
                            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-[#2e83fb] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_6px_18px_-8px_rgba(79,85,243,0.7)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-8px_rgba(79,85,243,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 motion-reduce:transition-none"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                            New Assessment
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </DashboardSection>
        </div>
      </div>
    </div>
  );
}

