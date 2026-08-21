import { AdminReportsClient } from "@/components/admin/admin-reports-client";
import { requirePageRole } from "@/lib/safe-auth";

export default async function AdminReportsPage() {
  await requirePageRole(["admin"]);
  return <AdminReportsClient />;
}
