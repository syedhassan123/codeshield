import { AdminSettingsClient } from "@/components/admin/admin-settings-client"; 
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import { getPlatformSettings } from "@/lib/settings/queries";

export default async function AdminSettingsPage() {
  const op = createServerOp({
    domain: "SETTINGS",
    operation: "PAGE",
    source: "SERVER-COMPONENT",
  });

  const session = await requirePageRole(["admin"]);
  op.auth(session.user);
  op.allowed({ action: "view_settings", role: session.user.role });
  await connectDB();

  const settings = await op.runMongo("load platform settings", () =>
    getPlatformSettings(),
  );
  op.respond({ loaded: true });

  return <AdminSettingsClient initialSettings={settings} />;
}
