"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Search } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import {
  NAV_ICONS,
  type NavItemConfig,
} from "@/components/layout/nav-icons";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn, initials } from "@/lib/utils";

export type NavItem = NavItemConfig;

export function WorkspaceShell({
  role,
  userName,
  nav,
  children,
}: {
  role: "admin" | "student" | "interviewer";
  userName: string;
  nav: NavItemConfig[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmSignOut = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      <aside className="hidden lg:flex w-64 flex-col border-r border-sidebar-border bg-sidebar sticky top-0 h-screen">
        <div className="h-16 px-5 flex items-center gap-2 border-b border-border">
          <BrandMark />
        </div>
        <div className="flex-1 p-3 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold px-3 py-2">
            {role} Workspace
          </div>
          {nav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== `/${role}` && pathname.startsWith(item.href));
            const Icon = NAV_ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[0_0_0_1px_var(--sidebar-accent)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
        <div className="p-3 border-t border-border">
          <button
            type="button"
            onClick={() => setSignOutOpen(true)}
            className="w-full cursor-pointer flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-4 lg:px-8 gap-4">
          <div className="lg:hidden">
            <BrandMark compact />
          </div>
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-background px-3 h-10">
            <Search className="w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search..."
              className="bg-transparent outline-none text-sm flex-1 placeholder:text-muted-foreground"
            />
          </div>
          <button className="relative w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
          </button>
          <div className="flex items-center gap-3 pl-3 border-l border-border">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold leading-tight">{userName}</div>
              <div className="text-[11px] text-muted-foreground capitalize">
                {role}
              </div>
            </div>
            <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white text-xs font-bold">
              {initials(userName)}
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 max-w-[1500px] w-full mx-auto">
          {children}
        </main>
      </div>

      <Modal
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        title="Sign out?"
        description="Are you sure you want to sign out of CodeShield?"
        className="max-w-md"
      >
        <div className="rounded-xl bg-warning-soft text-warning-foreground px-3 py-2.5 text-sm mb-5">
          You’ll need to sign in again to access your workspace.
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => setSignOutOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={confirmSignOut}
            disabled={pending}
            className="bg-danger hover:opacity-90 shadow-none"
            style={{ backgroundImage: "none" }}
          >
            {pending ? "Signing out…" : "Yes, sign out"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
