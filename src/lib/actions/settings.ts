"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import {
  getPlatformSettings,
  savePlatformSettings,
} from "@/lib/settings/queries";
import { savePlatformSettingsSchema } from "@/lib/validators/settings";

export async function getAdminSettingsAction() {
  const op = createServerOp({
    domain: "SETTINGS",
    operation: "GET",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin get settings");
    await connectDB();

    const settings = await getPlatformSettings();
    return op.respond({ settings });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function saveAdminSettingsAction(raw: unknown) {
  const op = createServerOp({
    domain: "SETTINGS",
    operation: "SAVE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    const data = savePlatformSettingsSchema.parse(raw);
    op.allowed("admin save settings");
    await connectDB();

    const settings = await savePlatformSettings(data, session.user.id);

    revalidatePath("/admin/settings");
    return op.respond({ settings });
  } catch (error) {
    return op.respondError(error);
  }
}
