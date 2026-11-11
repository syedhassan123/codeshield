/**
 * Idempotent server reminder sweep. Safe to run more than once.
 * Run: npx tsx --env-file=.env.local scripts/run-notification-reminders.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { processDueReminders } from "../src/lib/notifications/reminders";

async function main() {
  await connectDB();
  const result = await processDueReminders();
  console.log("Reminder sweep", result);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
