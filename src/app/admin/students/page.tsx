import { AdminStudentsClient } from "@/components/admin/admin-students-client";
import { requirePageRole } from "@/lib/safe-auth";

export default async function AdminStudentsPage() {
  await requirePageRole(["admin"]);
  return <AdminStudentsClient />;
}
