"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut } from "lucide-react";
import { BrandMark } from "@/components/layout/brand-mark";
import { WorkspaceSearch } from "@/components/layout/workspace-search";
import {
  NAV_ICONS,
  type NavItemConfig,
} from "@/components/layout/nav-icons";
import { logoutAction } from "@/lib/actions/auth";
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { formatRelativeTime } from "@/lib/admin/format";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn, initials } from "@/lib/utils";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const NOTIFICATIONS_POLL_MS = 30000;

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
  const router = useRouter();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const confirmSignOut = () => {
    startTransition(async () => {
      await logoutAction();
    });
  };

  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    void (async () => {
      const result = await getNotificationsAction();
      if ("notifications" in result) {
        setNotifications(result.notifications as NotificationItem[]);
        setUnreadCount(result.unreadCount);
      }
    })();
  };

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, NOTIFICATIONS_POLL_MS);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notifOpen) return;
    const onClickOutside = (event: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [notifOpen]);

  const handleToggleNotifications = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening) loadNotifications();
  };

  const handleNotificationClick = (item: NotificationItem) => {
    setNotifOpen(false);
    if (!item.read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      void markNotificationReadAction(item.id);
    }
    if (item.link) router.push(item.link);
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    void markAllNotificationsReadAction();
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
                  "flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
        <header className="h-16 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-30 flex items-center px-4 lg:px-8 gap-4 justify-center">
          <div className="lg:hidden">
            <BrandMark compact />
          </div>
          <WorkspaceSearch role={role} />
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={handleToggleNotifications}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              className="relative w-9 h-9 rounded-lg hover:bg-muted flex items-center justify-center"
            >
              <Bell className="w-4 h-4 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 max-h-[420px] overflow-y-auto rounded-xl border border-border bg-card shadow-elevated z-40">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-xs font-semibold text-primary hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                {notifications.length ? (
                  <div className="divide-y divide-border">
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNotificationClick(item)}
                        className={cn(
                          "w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors",
                          !item.read && "bg-primary/5",
                        )}
                      >
                        <div className="flex items-start gap-2">
                          {!item.read && (
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold truncate">
                              {item.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {item.message}
                            </div>
                            <div className="text-[10px] text-muted-foreground mt-1">
                              {formatRelativeTime(item.createdAt)}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-8 text-sm text-muted-foreground text-center">
                    No notifications yet.
                  </div>
                )}
              </div>
            )}
          </div>
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
