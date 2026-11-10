import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { debugLog } from "@/lib/debug";
import { processDueReminders } from "@/lib/notifications/reminders";

/**
 * Production reminder entry point. Call every 5 minutes from an external
 * scheduler (or scripts/run-notification-reminders.ts for local QA).
 *
 *   POST /api/cron/notification-reminders
 *   Authorization: Bearer <CRON_SECRET>
 *
 * GET remains for compatibility with simple HTTP monitors. Prefer POST.
 * The header bell does not call this route and does not run the sweep.
 */

type AuthResult = "ok" | "unauthorized" | "misconfigured";

function authorizeCron(request: Request): AuthResult {
  const secret = process.env.CRON_SECRET;
  if (!secret) return "misconfigured";

  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return "unauthorized";

  const provided = header.slice("Bearer ".length);
  const expected = Buffer.from(secret);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return "unauthorized";
  if (!timingSafeEqual(expected, actual)) return "unauthorized";
  return "ok";
}

async function runSweep(request: Request, source: "GET" | "POST") {
  const auth = authorizeCron(request);
  if (auth === "misconfigured") {
    debugLog("NOTIFICATION", "REMINDER_SWEEP_FAILED", {
      source,
      reason: "CRON_SECRET missing",
    });
    return NextResponse.json(
      { ok: false, error: "Reminder scheduler is not configured" },
      { status: 503 },
    );
  }
  if (auth === "unauthorized") {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  debugLog("NOTIFICATION", "REMINDER_SWEEP_STARTED", { source });

  try {
    await connectDB();
    const result = await processDueReminders();
    const durationMs = Date.now() - startedAt;
    debugLog("NOTIFICATION", "REMINDER_SWEEP_COMPLETED", {
      source,
      interviewReminders: result.interviews,
      assessmentReminders: result.assessments,
      durationMs,
    });
    return NextResponse.json({
      ok: true,
      interviewReminders: result.interviews,
      assessmentReminders: result.assessments,
      durationMs,
    });
  } catch (error) {
    debugLog("NOTIFICATION", "REMINDER_SWEEP_FAILED", {
      source,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { ok: false, error: "Reminder sweep failed" },
      { status: 500 },
    );
  }
}

export function GET(request: Request) {
  return runSweep(request, "GET");
}

export function POST(request: Request) {
  return runSweep(request, "POST");
}
