"use client";

import { usePathname } from "next/navigation";
import type { NavItemConfig } from "@/components/layout/nav-icons";
import { WorkspaceShell } from "@/components/layout/workspace-shell";

export function RoleLayoutClient({
  role,
  userName,
  nav,
  children,
  fullscreenPrefixes,
}: {
  role: "admin" | "student" | "interviewer";
  userName: string;
  nav: NavItemConfig[];
  children: React.ReactNode;
  fullscreenPrefixes: string[];
}) {
  const pathname = usePathname();
  const fullscreen = fullscreenPrefixes.some((p) => pathname.includes(p));

  if (fullscreen) {
    return <>{children}</>;
  }

  return (
    <WorkspaceShell role={role} userName={userName} nav={nav}>
      {children}
    </WorkspaceShell>
  );
}
