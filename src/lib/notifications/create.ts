import type mongoose from "mongoose";
import { debugLog } from "@/lib/debug";
import { Notification, type NotificationType } from "@/models/Notification";

/** App-relative paths only. Rejects protocol-relative and external URLs. */
export function safeNotificationPath(link: string | null | undefined) {
  if (!link) return null;
  if (!link.startsWith("/") || link.startsWith("//") || link.includes("://")) {
    return null;
  }
  if (link.includes("\\") || /\s/.test(link)) return null;
  return link;
}

function isDuplicateKey(error: unknown) {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  );
}

/**
 * Best-effort notification write. A notification failure must never break
 * the real operation it's attached to (certificate issuance, grading,
 * interview scheduling, etc.) — so errors are logged, not thrown.
 * A dedupeKey inserts at most one document; a repeat is a no-op.
 */
export async function createNotification(options: {
  userId: mongoose.Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  dedupeKey?: string | null;
}) {
  const link = safeNotificationPath(options.link);
  const doc: Record<string, unknown> = {
    userId: options.userId,
    type: options.type,
    title: options.title,
    message: options.message,
    link,
    read: false,
    readAt: null,
  };
  if (options.dedupeKey) doc.dedupeKey = options.dedupeKey;

  try {
    if (options.dedupeKey) {
      await Notification.updateOne(
        { dedupeKey: options.dedupeKey },
        { $setOnInsert: doc },
        { upsert: true },
      );
      return;
    }
    await Notification.create(doc);
  } catch (error) {
    if (isDuplicateKey(error)) return;
    debugLog("NOTIFICATION", "CREATE_FAILED", {
      type: options.type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
