import { auth } from "@/lib/auth";
import type { NavItemConfig } from "@/components/layout/nav-icons";
import { RoleLayoutClient } from "@/components/layout/role-layout-client";

const nav: NavItemConfig[] = [
  { href: "/interviewer", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/interviewer/interviews", label: "My Interviews", icon: "Video" },
  { href: "/interviewer/candidates", label: "Candidates", icon: "Users" },
  {
    href: "/interviewer/evaluations",
    label: "Evaluations",
    icon: "ClipboardCheck",
  },
];

export default async function InterviewerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <RoleLayoutClient
      role="interviewer"
      userName={session?.user?.name || "Interviewer"}
      nav={nav}
      fullscreenPrefixes={["/interviewer/lobby/", "/interviewer/room/"]}
    >
      {children}
    </RoleLayoutClient>
  );
}
