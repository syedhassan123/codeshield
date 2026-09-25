"use server";

import { requireSession } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notifications/queries";

/** Any authenticated role (admin/student/interviewer) reads only their own notifications. */
export async function getNotificationsAction() {
  const op = createServerOp({
    domain: "NOTIFICATION",
    operation: "LIST",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireSession();
    op.auth(session.user);
    await connectDB();
    op.allowed({ action: "list_own_notifications", role: session.user.role });

    const result = await listNotificationsForUser(session.user.id);
    return op.respond(result);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function markNotificationReadAction(notificationId: string) {
  const op = createServerOp({
    domain: "NOTIFICATION",
    operation: "MARK_READ",
    source: "SERVER-ACTION",
    resourceId: notificationId,
  });

  try {
    const session = await requireSession();
    op.auth(session.user);
    await connectDB();

    const updated = await markNotificationRead(
      notificationId,
      session.user.id,
    );
    op.allowed({ action: "mark_own_notification_read", role: session.user.role });

    return op.respond({ success: !!updated });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function markAllNotificationsReadAction() {
  const op = createServerOp({
    domain: "NOTIFICATION",
    operation: "MARK_ALL_READ",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireSession();
    op.auth(session.user);
    await connectDB();
    op.allowed({
      action: "mark_all_own_notifications_read",
      role: session.user.role,
    });

    await markAllNotificationsRead(session.user.id);
    return op.respond({ success: true });
  } catch (error) {
    return op.respondError(error);
  }
}
