import mongoose from "mongoose";
import { Notification } from "@/models/Notification";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
};

const LIST_LIMIT = 20;
/** Bell dropdown only. The history page uses NOTIFICATION_PAGE_SIZE. */
export const NOTIFICATION_RECENT_LIMIT = 8;
export const NOTIFICATION_PAGE_SIZE = 20;

function toRow(n: {
  _id: { toString(): string };
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  readAt?: Date | null;
  createdAt: Date;
}): NotificationRow {
  return {
    id: n._id.toString(),
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link ?? null,
    read: n.read,
    readAt: n.readAt ? new Date(n.readAt).toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

export async function listNotificationsForUser(
  userId: string,
): Promise<{ notifications: NotificationRow[]; unreadCount: number }> {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(LIST_LIMIT),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return {
    notifications: items.map(toRow),
    unreadCount,
  };
}

/** Latest items for the header bell. Unread count is still the full total. */
export async function listRecentNotificationsForUser(userId: string) {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .limit(NOTIFICATION_RECENT_LIMIT),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return {
    notifications: items.map(toRow),
    unreadCount,
  };
}

export async function listNotificationPage(userId: string, page: number) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const skip = (safePage - 1) * NOTIFICATION_PAGE_SIZE;
  const [items, total, unreadCount] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(NOTIFICATION_PAGE_SIZE),
    Notification.countDocuments({ userId }),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return {
    notifications: items.map(toRow),
    unreadCount,
    page: safePage,
    pageSize: NOTIFICATION_PAGE_SIZE,
    total,
    hasMore: skip + items.length < total,
  };
}

/** IDOR-safe: only marks read if the notification belongs to this user;
 * returns null on both "not found" and "not owned" (no existence leak). */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
) {
  if (!mongoose.Types.ObjectId.isValid(notificationId)) return null;
  return Notification.findOneAndUpdate(
    { _id: notificationId, userId },
    { $set: { read: true, readAt: new Date() } },
    { returnDocument: "after" },
  );
}

export async function markAllNotificationsRead(userId: string) {
  await Notification.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } },
  );
}
