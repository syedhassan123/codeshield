"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { formatRelativeTime } from "@/lib/admin/format";
import { cn } from "@/lib/utils";

export type NotificationHistoryItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  ASSESSMENT_ASSIGNED: "Assessment",
  ASSESSMENT_REMINDER: "Assessment",
  INTERVIEW_SCHEDULED: "Interview",
  INTERVIEW_RESCHEDULED: "Interview",
  INTERVIEW_CANCELLED: "Interview",
  INTERVIEW_REMINDER: "Interview",
  INTERVIEW_EVALUATION_PENDING: "Evaluation",
  CERTIFICATE_ISSUED: "Certificate",
  CERTIFICATE_REVOKED: "Certificate",
  RESULT_READY: "Result",
};

function isSafeAppPath(link: string | null) {
  return !!link && link.startsWith("/") && !link.startsWith("//") && !link.includes("://");
}

export function NotificationsHistory({
  items,
  unreadCount,
  page,
  hasMore,
  total,
}: {
  items: NotificationHistoryItem[];
  unreadCount: number;
  page: number;
  hasMore: boolean;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(items);
  const [unread, setUnread] = useState(unreadCount);

  const markOne = (item: NotificationHistoryItem) => {
    if (!item.read) {
      setRows((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, read: true } : row)),
      );
      setUnread((count) => Math.max(0, count - 1));
      void markNotificationReadAction(item.id);
    }
    if (isSafeAppPath(item.link)) {
      router.push(item.link as string);
    }
  };

  const markAll = () => {
    setRows((prev) => prev.map((row) => ({ ...row, read: true })));
    setUnread(0);
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  };

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={
          unread > 0
            ? `${unread} unread`
            : "You're all caught up"
        }
        actions={
          unread > 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={markAll}
              disabled={pending}
            >
              Mark all as read
            </Button>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card px-4 py-12 text-center">
          <p className="text-sm font-semibold">You&apos;re all caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">No notifications yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {rows.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => markOne(item)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/50",
                  !item.read && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    item.read ? "bg-transparent" : "bg-primary",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold break-words">
                      {item.title}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {TYPE_LABELS[item.type] ?? "Update"}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm text-muted-foreground break-words">
                    {item.message}
                  </span>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    {formatRelativeTime(item.createdAt)}
                    {item.read ? "" : " · Unread"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {total > 0 && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={`?page=${page - 1}`}
              className="font-semibold text-primary hover:underline"
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasMore ? (
            <Link
              href={`?page=${page + 1}`}
              className="font-semibold text-primary hover:underline"
            >
              Next
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
