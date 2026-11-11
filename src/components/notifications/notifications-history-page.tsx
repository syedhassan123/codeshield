import { NotificationsHistory } from "@/components/notifications/notifications-history";
import { getNotificationPageAction } from "@/lib/actions/notifications";

export async function NotificationsHistoryPage({ page }: { page: number }) {
  const result = await getNotificationPageAction(page);

  if (!("notifications" in result)) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-10 text-center">
        <p className="text-sm font-semibold">Notifications are unavailable</p>
        <p className="mt-1 text-sm text-muted-foreground">
          You can keep using the rest of the workspace.
        </p>
      </div>
    );
  }

  return (
    <NotificationsHistory
      key={result.page}
      items={result.notifications}
      unreadCount={result.unreadCount}
      page={result.page}
      hasMore={result.hasMore}
      total={result.total}
    />
  );
}
