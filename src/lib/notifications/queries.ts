import mongoose from "mongoose";
import { Notification } from "@/models/Notification";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const LIST_LIMIT = 20;

export async function listNotificationsForUser(
  userId: string,
): Promise<{ notifications: NotificationRow[]; unreadCount: number }> {
  const [items, unreadCount] = await Promise.all([
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(LIST_LIMIT),
    Notification.countDocuments({ userId, read: false }),
  ]);

  return {
    notifications: items.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      message: n.message,
      link: n.link ?? null,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
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
    { $set: { read: true } },
    { returnDocument: "after" },
  );
}

export async function markAllNotificationsRead(userId: string) {
  await Notification.updateMany(
    { userId, read: false },
    { $set: { read: true } },
  );
}
