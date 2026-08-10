import { auth } from "@/lib/auth";
import type { NavItemConfig } from "@/components/layout/nav-icons";
import { RoleLayoutClient } from "@/components/layout/role-layout-client";

const nav: NavItemConfig[] = [
  { href: "/student", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/student/assessments", label: "Assessments", icon: "ClipboardList" },
  { href: "/student/coding", label: "Coding Tests", icon: "Code2" },
  { href: "/student/interviews", label: "Interviews", icon: "Video" },
  { href: "/student/results", label: "Results", icon: "Trophy" },
  { href: "/student/certificates", label: "Certificates", icon: "Award" },
  { href: "/student/profile", label: "Profile", icon: "UserRound" },
];

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <RoleLayoutClient
      role="student"
      userName={session?.user?.name || "Student"}
      nav={nav}
      fullscreenPrefixes={["/student/exam/", "/student/code/"]}
    >
      {children}
    </RoleLayoutClient>
  );
}
