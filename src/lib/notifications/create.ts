import type mongoose from "mongoose";
import { debugLog } from "@/lib/debug";
import { Notification, type NotificationType } from "@/models/Notification";

/**
 * Best-effort notification write. A notification failure must never break
 * the real operation it's attached to (certificate issuance, grading,
 * interview scheduling, etc.) — so errors are logged, not thrown.
 */
export async function createNotification(options: {
  userId: mongoose.Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
}) {
  try {
    await Notification.create({
      userId: options.userId,
      type: options.type,
      title: options.title,
      message: options.message,
      link: options.link ?? null,
    });
  } catch (error) {
    debugLog("NOTIFICATION", "CREATE_FAILED", {
      type: options.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
