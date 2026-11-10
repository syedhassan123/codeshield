import { NotificationsHistoryPage } from "@/components/notifications/notifications-history-page";

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = Number(params.page ?? "1");
  return <NotificationsHistoryPage page={page} />;
}
