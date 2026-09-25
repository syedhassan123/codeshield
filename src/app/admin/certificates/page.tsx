import { AdminCertificatesClient } from "@/components/admin/admin-certificates-client";
import { requirePageRole } from "@/lib/safe-auth";

export default async function AdminCertificatesPage() {
  await requirePageRole(["admin"]);
  return <AdminCertificatesClient />;
}
