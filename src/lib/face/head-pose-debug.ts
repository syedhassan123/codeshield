import type { HeadOrientation } from "@/lib/face/head-pose-orientation";

const SNAPSHOT_INTERVAL_MS = 1000;

let lastSnapshotAt = 0;
let lastLoggedOrientation: HeadOrientation | "PAUSED" | null = null;

function isDevLoggingEnabled() {
  return process.env.NODE_ENV === "development";
}

export function headDebugSnapshot(fields: Record<string, unknown>) {
  if (!isDevLoggingEnabled()) return;

  const now = Date.now();
  if (now - lastSnapshotAt < SNAPSHOT_INTERVAL_MS) return;
  lastSnapshotAt = now;

  const lines = Object.entries(fields).map(([key, value]) => `${key}=${value}`);
  console.log("[HEAD DEBUG]");
  for (const line of lines) {
    console.log(line);
  }
}

export function headDebugTransition(
  from: HeadOrientation | "PAUSED",
  to: HeadOrientation | "PAUSED",
) {
  if (!isDevLoggingEnabled()) return;
  if (from === to) return;
  console.log("[HEAD DEBUG]");
  console.log(`${from} → ${to}`);
  lastLoggedOrientation = to === "PAUSED" ? "PAUSED" : to;
}

export function headDebugMessage(message: string) {
  if (!isDevLoggingEnabled()) return;
  console.log("[HEAD DEBUG]");
  console.log(message);
}

export function headDebugEventPersisted(eventType: string) {
  if (!isDevLoggingEnabled()) return;
  console.log("[HEAD DEBUG]");
  console.log(`${eventType} event persisted`);
}

export function headServerLog(message: string, extra?: Record<string, unknown>) {
  if (!isDevLoggingEnabled()) return;
  if (extra) {
    console.log("[HEAD SERVER]", message, extra);
    return;
  }
  console.log("[HEAD SERVER]", message);
}

export function headDebugSecurityConfig(config: Record<string, unknown>) {
  if (!isDevLoggingEnabled()) return;
  console.log("[HEAD DEBUG]");
  console.log("security configuration (normalized)");
  for (const [key, value] of Object.entries(config)) {
    console.log(`${key}=${value}`);
  }
}

export function resetHeadDebugOrientation() {
  lastLoggedOrientation = null;
}

export function getLastLoggedOrientation() {
  return lastLoggedOrientation;
}
