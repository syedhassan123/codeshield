import { AdminMonitoringClient } from "@/components/admin/admin-monitoring-client";
import { requirePageRole } from "@/lib/safe-auth";

export default async function AdminMonitoringPage() {
  await requirePageRole(["admin"]);
  return <AdminMonitoringClient />;
}
