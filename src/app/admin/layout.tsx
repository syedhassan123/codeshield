import { auth } from "@/lib/auth";
import type { NavItemConfig } from "@/components/layout/nav-icons";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

const nav: NavItemConfig[] = [
  { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/admin/assessments", label: "Assessments", icon: "ClipboardList" },
  { href: "/admin/questions", label: "Question Bank", icon: "BookOpen" },
  { href: "/admin/students", label: "Students", icon: "Users" },
  { href: "/admin/interviews", label: "Interviews", icon: "Video" },
  { href: "/admin/monitoring", label: "AI Monitoring", icon: "ShieldAlert" },
  { href: "/admin/analytics", label: "Analytics", icon: "BarChart3" },
  { href: "/admin/reports", label: "Reports", icon: "FileText" },
  { href: "/admin/settings", label: "Settings", icon: "Settings" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <WorkspaceShell
      role="admin"
      userName={session?.user?.name || "Admin"}
      nav={nav}
    >
      {children}
    </WorkspaceShell>
  );
}
