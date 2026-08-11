import { AdminResultsClient } from "@/components/admin/admin-results-client";
import { requirePageRole } from "@/lib/safe-auth";

export default async function AdminResultsPage() {
  await requirePageRole(["admin"]);
  return <AdminResultsClient />;
}
