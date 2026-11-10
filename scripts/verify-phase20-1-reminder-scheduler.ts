/**
 * Phase 20.1 — production reminder scheduler hardening.
 * Run: npx tsx --env-file=.env.local scripts/verify-phase20-1-reminder-scheduler.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { POST, GET } from "../src/app/api/cron/notification-reminders/route";
import { connectDB } from "../src/lib/db";
import {
  interviewReminderDedupeKey,
  assessmentReminderDedupeKey,
} from "../src/lib/notifications/events";
import {
  INTERVIEW_REMINDER_LEAD_MS,
  REMINDER_TOLERANCE_MS,
  isDueForReminder,
  processDueReminders,
} from "../src/lib/notifications/reminders";
import { Assessment } from "../src/models/Assessment";
import { Attempt } from "../src/models/Attempt";
import { Interview } from "../src/models/Interview";
import { Notification } from "../src/models/Notification";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

const TEST_SECRET = "phase20-1-verify-secret-do-not-use-in-prod";

function staticChecks() {
  const actions = read("src/lib/actions/notifications.ts");
  assert(
    !actions.includes("processDueReminders"),
    "bell/list/page actions do not call processDueReminders",
  );

  const shell = read("src/components/layout/workspace-shell.tsx");
  assert(
    shell.includes("NOTIFICATIONS_POLL_MS = 30000"),
    "header still polls about every 30 seconds for display",
  );
  assert(
    shell.includes("getNotificationsAction"),
    "header still loads recent notifications",
  );
  assert(
    !shell.includes("CRON_SECRET") && !shell.includes("processDueReminders"),
    "client shell never touches CRON_SECRET or the reminder engine",
  );

  const cron = read("src/app/api/cron/notification-reminders/route.ts");
  assert(cron.includes("timingSafeEqual"), "cron auth uses a constant-time compare");
  assert(cron.includes("Bearer "), "cron auth requires Bearer token");
  assert(cron.includes("503"), "missing CRON_SECRET fails closed with 503");
  assert(cron.includes("401"), "wrong/missing Authorization returns 401");
  assert(cron.includes('source: "POST"') || cron.includes('"POST"'), "POST is a first-class method");
  assert(
    !cron.includes("searchParams") && !cron.includes("request.json"),
    "secret is never read from query string or body",
  );

  const reminders = read("src/lib/notifications/reminders.ts");
  assert(
    reminders.includes("INTERVIEW_REMINDER_LEAD_MS = 30 * 60 * 1000"),
    "interview lead remains 30 minutes",
  );
  assert(
    reminders.includes("REMINDER_TOLERANCE_MS = 5 * 60 * 1000"),
    "late tolerance remains 5 minutes (one missed 5-min tick)",
  );
  assert(
    reminders.includes('status: "scheduled"'),
    "interview reminders still require scheduled status",
  );

  assert(
    !fs.existsSync("vercel.json") ||
      !read("vercel.json").includes('"crons"'),
    "no misleading Vercel Hobby daily cron is declared for this 5-minute job",
  );

  const envExample = read(".env.example");
  assert(envExample.includes("CRON_SECRET="), ".env.example documents CRON_SECRET");
  assert(
    !envExample.includes("NEXT_PUBLIC_CRON"),
    "CRON_SECRET is not exposed as NEXT_PUBLIC",
  );

  const shellSrc = read("src/components/layout/workspace-shell.tsx");
  const historySrc = read("src/components/notifications/notifications-history.tsx");
  assert(
    !shellSrc.includes("CRON_SECRET") && !historySrc.includes("CRON_SECRET"),
    "bell and history UI do not reference CRON_SECRET",
  );

  assert(
    fs.existsSync("docs/REMINDER-SCHEDULER.md"),
    "production scheduler setup document exists",
  );
  assert(
    fs.existsSync("scripts/run-notification-reminders.ts"),
    "manual reminder runner still exists",
  );
}

async function withSecret<T>(fn: () => Promise<T>): Promise<T> {
  const previous = process.env.CRON_SECRET;
  process.env.CRON_SECRET = TEST_SECRET;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

async function securityChecks() {
  const previous = process.env.CRON_SECRET;
  delete process.env.CRON_SECRET;
  const misconfigured = await POST(
    new Request("http://localhost/api/cron/notification-reminders", {
      method: "POST",
    }),
  );
  assert(misconfigured.status === 503, "missing CRON_SECRET → 503");
  const misconfiguredBody = (await misconfigured.json()) as { error?: string };
  assert(
    misconfiguredBody.error === "Reminder scheduler is not configured",
    "missing secret returns a safe configuration error",
  );

  process.env.CRON_SECRET = TEST_SECRET;
  try {
    const missingAuth = await POST(
      new Request("http://localhost/api/cron/notification-reminders", {
        method: "POST",
      }),
    );
    assert(missingAuth.status === 401, "missing Authorization → 401");

    const wrong = await POST(
      new Request("http://localhost/api/cron/notification-reminders", {
        method: "POST",
        headers: { Authorization: "Bearer wrong-secret" },
      }),
    );
    assert(wrong.status === 401, "wrong secret → 401");

    const ok = await POST(
      new Request("http://localhost/api/cron/notification-reminders", {
        method: "POST",
        headers: { Authorization: `Bearer ${TEST_SECRET}` },
      }),
    );
    assert(ok.status === 200, "correct secret → 200");
    const body = (await ok.json()) as {
      ok?: boolean;
      interviewReminders?: number;
      assessmentReminders?: number;
      durationMs?: number;
    };
    assert(body.ok === true, "correct secret response is ok");
    assert(
      typeof body.interviewReminders === "number" &&
        typeof body.assessmentReminders === "number" &&
        typeof body.durationMs === "number",
      "response reports reminder counts and duration without PII",
    );

    const getOk = await GET(
      new Request("http://localhost/api/cron/notification-reminders", {
        method: "GET",
        headers: { Authorization: `Bearer ${TEST_SECRET}` },
      }),
    );
    assert(getOk.status === 200, "GET remains available with the same auth");
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
}

async function reminderChecks() {
  await connectDB();

  const demo = await User.findOne({ email: "demo@codeshield.ai" });
  const kabir = await User.findOne({ email: "kabir@codeshield.ai" });
  const admin = await User.findOne({ email: "admin@codeshield.ai" });
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" });
  assert(demo && kabir && admin && rohan, "seed users exist");

  const now = new Date();
  const interviewIds: mongoose.Types.ObjectId[] = [];
  let assessmentId: mongoose.Types.ObjectId | null = null;
  let attemptId: mongoose.Types.ObjectId | null = null;

  const cleanup = async () => {
    if (interviewIds.length) {
      await Interview.deleteMany({ _id: { $in: interviewIds } });
      await Notification.deleteMany({
        $or: interviewIds.map((id) => ({
          dedupeKey: { $regex: id.toString() },
        })),
      });
    }
    if (assessmentId) {
      await Notification.deleteMany({
        dedupeKey: { $regex: assessmentId.toString() },
      });
      await Assessment.deleteMany({ _id: assessmentId });
    }
    if (attemptId) await Attempt.deleteMany({ _id: attemptId });
  };

  try {
    assert(
      INTERVIEW_REMINDER_LEAD_MS === 30 * 60 * 1000,
      "interview reminder lead is 30 minutes",
    );
    assert(
      REMINDER_TOLERANCE_MS === 5 * 60 * 1000,
      "reminder late tolerance is 5 minutes",
    );
    assert(
      isDueForReminder(
        new Date(now.getTime() + 28 * 60 * 1000),
        now,
        INTERVIEW_REMINDER_LEAD_MS,
      ),
      "an interview whose dueAt is within grace is due",
    );
    assert(
      !isDueForReminder(
        new Date(now.getTime() + 20 * 60 * 1000),
        now,
        INTERVIEW_REMINDER_LEAD_MS,
      ),
      "an interview still before dueAt is not due",
    );
    assert(
      !isDueForReminder(
        new Date(now.getTime() - 60_000),
        now,
        INTERVIEW_REMINDER_LEAD_MS,
      ),
      "an interview whose scheduledAt already passed is not due",
    );
    assert(
      !isDueForReminder(
        new Date(now.getTime() - 4 * 60 * 1000),
        now,
        INTERVIEW_REMINDER_LEAD_MS,
      ),
      "an interview 4 minutes past start never gets an upcoming reminder",
    );

    const due = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20.1 due",
      type: "Technical",
      scheduledAt: new Date(now.getTime() + 28 * 60 * 1000),
      durationMin: 30,
      status: "scheduled",
    });
    interviewIds.push(due._id);

    const startedAlready = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20.1 already started",
      type: "Technical",
      scheduledAt: new Date(now.getTime() - 2 * 60 * 1000),
      durationMin: 30,
      status: "scheduled",
    });
    interviewIds.push(startedAlready._id);

    const oldTime = new Date(now.getTime() + 27 * 60 * 1000);
    const newTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const rescheduleTarget = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20.1 reschedule",
      type: "Technical",
      scheduledAt: oldTime,
      durationMin: 30,
      status: "scheduled",
    });
    interviewIds.push(rescheduleTarget._id);

    const cancelled = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20.1 cancelled",
      type: "Technical",
      scheduledAt: new Date(now.getTime() + 12 * 60 * 1000),
      durationMin: 30,
      status: "cancelled",
    });
    interviewIds.push(cancelled._id);

    const completed = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20.1 completed",
      type: "Technical",
      scheduledAt: new Date(now.getTime() + 12 * 60 * 1000),
      durationMin: 30,
      status: "completed",
    });
    interviewIds.push(completed._id);

    const assessment = await Assessment.create({
      code: `ASM-P201-${Date.now()}`,
      title: "Phase 20.1 assessment reminder",
      type: "mcq",
      category: "Programming",
      difficulty: "easy",
      status: "scheduled",
      durationMin: 30,
      totalMarks: 10,
      visibility: "assigned",
      assignedStudentIds: [demo!._id, rohan!._id],
      scheduledAt: new Date(now.getTime() + 58 * 60 * 1000),
      createdBy: admin!._id,
    });
    assessmentId = assessment._id;
    const finished = await Attempt.create({
      studentId: rohan!._id,
      assessmentId: assessment._id,
      status: "submitted",
      startedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      durationMin: 30,
      assessmentTitle: assessment.title,
      totalMarks: 10,
      submittedAt: now,
    });
    attemptId = finished._id;

    // Reschedule before any sweep so the old soon-slot never becomes a reminder.
    await Interview.updateOne(
      { _id: rescheduleTarget._id },
      { $set: { scheduledAt: newTime } },
    );

    await processDueReminders(now);
    await processDueReminders(now);

    const studentKey = interviewReminderDedupeKey(
      due._id.toString(),
      demo!._id.toString(),
      due.scheduledAt,
    );
    const interviewerKey = interviewReminderDedupeKey(
      due._id.toString(),
      kabir!._id.toString(),
      due.scheduledAt,
    );
    assert(
      (await Notification.countDocuments({ dedupeKey: studentKey })) === 1,
      "interview reminder creates one student notification",
    );
    assert(
      (await Notification.countDocuments({ dedupeKey: interviewerKey })) === 1,
      "interview reminder creates one interviewer notification",
    );
    assert(
      (await Notification.countDocuments({
        type: "INTERVIEW_REMINDER",
        dedupeKey: {
          $regex: startedAlready._id.toString(),
        },
      })) === 0,
      "scheduledAt already passed → 0 INTERVIEW_REMINDER",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          cancelled._id.toString(),
          demo!._id.toString(),
          cancelled.scheduledAt,
        ),
      })) === 0,
      "cancelled interview produces no reminder",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          completed._id.toString(),
          demo!._id.toString(),
          completed.scheduledAt,
        ),
      })) === 0,
      "completed interview produces no upcoming reminder",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          rescheduleTarget._id.toString(),
          demo!._id.toString(),
          oldTime,
        ),
      })) === 0,
      "old schedule after reschedule does not remind",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          rescheduleTarget._id.toString(),
          demo!._id.toString(),
          newTime,
        ),
      })) === 0,
      "new schedule outside the window does not remind yet",
    );

    const assessmentKey = assessmentReminderDedupeKey(
      assessment._id.toString(),
      demo!._id.toString(),
      assessment.scheduledAt!,
    );
    assert(
      (await Notification.countDocuments({ dedupeKey: assessmentKey })) === 1,
      "eligible assessment start reminder fires once",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: assessmentReminderDedupeKey(
          assessment._id.toString(),
          rohan!._id.toString(),
          assessment.scheduledAt!,
        ),
      })) === 0,
      "submitted student does not get an assessment reminder",
    );

    await Promise.all([processDueReminders(now), processDueReminders(now)]);
    assert(
      (await Notification.countDocuments({ dedupeKey: studentKey })) === 1,
      "concurrent sweeps still produce one student reminder",
    );
    assert(
      (await Notification.countDocuments({ dedupeKey: assessmentKey })) === 1,
      "concurrent sweeps still produce one assessment reminder",
    );

    await withSecret(async () => {
      const first = await POST(
        new Request("http://localhost/api/cron/notification-reminders", {
          method: "POST",
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        }),
      );
      const second = await POST(
        new Request("http://localhost/api/cron/notification-reminders", {
          method: "POST",
          headers: { Authorization: `Bearer ${TEST_SECRET}` },
        }),
      );
      assert(first.status === 200 && second.status === 200, "cron endpoint runs without a browser");
      assert(
        (await Notification.countDocuments({ dedupeKey: studentKey })) === 1,
        "duplicate cron invocations do not duplicate reminders",
      );
    });
  } finally {
    await cleanup();
  }
}

async function main() {
  console.log("Phase 20.1 reminder scheduler verification\n");
  staticChecks();
  await securityChecks();
  await reminderChecks();
  console.log("\nPASS: Phase 20.1 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
