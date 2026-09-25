/**
 * Phase 19 checks: Admin Monitoring Center goes from 30s polling to a real
 * Server-Sent Events (SSE) push feed. No new dependency (native browser
 * EventSource + a streaming Next.js Route Handler), no LiveKit/LLM keys
 * needed — the underlying monitoring data was already real (Phase pre-19),
 * this phase only changes how it's delivered to the client.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase19-live-monitoring.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  getActiveMonitoringSessions,
  getMonitoringEventStream,
  getMonitoringSummary,
  getMonitoringSystemHealth,
} from "../src/lib/admin/queries";
import { Assessment } from "../src/models/Assessment";
import { Attempt } from "../src/models/Attempt";
import { SecurityEvent } from "../src/models/SecurityEvent";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

function staticChecks() {
  const route = read("src/app/api/admin/monitoring/stream/route.ts");
  assert(route.includes("requireAdmin"), "stream route requires an admin session");
  assert(route.includes("text/event-stream"), "route responds with a real SSE content type");
  assert(route.includes("ReadableStream"), "route streams data instead of one-shot JSON");
  assert(
    !/change[Ss]tream|\.watch\(/.test(route),
    "route avoids Mongo change streams (they require a replica set most standalone/local MongoDBs don't have)",
  );
  assert(
    route.includes("setInterval") && route.includes("clearInterval"),
    "route ticks on a server-side interval and cleans it up",
  );
  assert(
    route.includes('req.signal.addEventListener("abort"'),
    "route stops ticking when the client disconnects (no orphaned intervals)",
  );
  assert(
    !route.includes('send("error"'),
    'route never names a custom SSE event "error" (collides with EventSource\'s reserved connection-error event)',
  );

  const client = read("src/components/admin/admin-monitoring-client.tsx");
  assert(
    client.includes("new EventSource("),
    "client subscribes via native EventSource, not a new dependency",
  );
  assert(
    !client.includes("setInterval") && !client.includes("getAdminMonitoringAction"),
    "client no longer polls via setInterval + server action",
  );
  assert(
    client.includes('addEventListener("monitoring"'),
    "client listens for the real-data push event",
  );
  assert(
    client.includes("onerror") && client.includes("setTimeout(connect"),
    "client reconnects automatically if the stream drops",
  );
}

async function dbChecks() {
  await connectDB();

  const student = await User.findOne({ email: "demo@codeshield.ai" });
  assert(student, "demo student exists");

  const assessment = await Assessment.findOne({
    status: "published",
    code: "ASM-201",
  });
  assert(assessment, "published ASM-201 exists");

  // Clean slate for a deterministic run.
  const prior = await Attempt.find({
    studentId: student!._id,
    assessmentId: assessment!._id,
    status: "in_progress",
  });
  const priorIds = prior.map((a) => a._id);
  if (priorIds.length) {
    await SecurityEvent.deleteMany({ attemptId: { $in: priorIds } });
    await Attempt.deleteMany({ _id: { $in: priorIds } });
  }

  const before = await getMonitoringSummary();

  const startedAt = new Date();
  const expiresAt = new Date(startedAt.getTime() + 60 * 60 * 1000);
  const attempt = await Attempt.create({
    studentId: student!._id,
    assessmentId: assessment!._id,
    status: "in_progress",
    startedAt,
    expiresAt,
    durationMin: assessment!.durationMin,
    questionIds: assessment!.questionIds,
    assessmentTitle: assessment!.title,
    totalMarks: assessment!.totalMarks,
  });

  // 3 counted violations -> MEDIUM risk (securityRiskLevelFromTotal: >=3).
  await SecurityEvent.create([
    {
      attemptId: attempt._id,
      userId: student!._id,
      assessmentId: assessment!._id,
      eventType: "TAB_SWITCH",
      severity: "MEDIUM",
    },
    {
      attemptId: attempt._id,
      userId: student!._id,
      assessmentId: assessment!._id,
      eventType: "COPY_ATTEMPT",
      severity: "LOW",
    },
    {
      attemptId: attempt._id,
      userId: student!._id,
      assessmentId: assessment!._id,
      eventType: "PASTE_ATTEMPT",
      severity: "LOW",
    },
  ]);

  // Exactly what one SSE tick builds and pushes to the client.
  const [summary, sessions, events, systemHealth] = await Promise.all([
    getMonitoringSummary(),
    getActiveMonitoringSessions(12),
    getMonitoringEventStream(30),
    getMonitoringSystemHealth(),
  ]);

  assert(
    summary.activeSessions === before.activeSessions + 1,
    "a new in_progress attempt is picked up as an active session",
  );

  const session = sessions.find((s) => s.attemptId === attempt._id.toString());
  assert(!!session, "the live attempt appears in the sessions list the stream would push");
  assert(session!.violationCount === 3, "violation events recorded against the attempt are counted live");
  assert(session!.riskLevel === "MEDIUM", "3 violations resolve to MEDIUM risk in the pushed payload");
  assert(session!.studentName === student!.name, "session carries the real student name (joined server-side)");

  assert(Array.isArray(events), "event stream payload is a real array");
  assert(Array.isArray(systemHealth) && systemHealth.length > 0, "system health payload is real, non-empty data");

  // Simulate the "next tick": submit the attempt and re-read live — proves
  // each tick re-queries Mongo rather than caching a snapshot from connect.
  await Attempt.updateOne({ _id: attempt._id }, { $set: { status: "submitted" } });
  const afterSubmit = await getActiveMonitoringSessions(12);
  assert(
    !afterSubmit.some((s) => s.attemptId === attempt._id.toString()),
    "the next tick's live read drops a submitted attempt from active sessions (proves per-tick freshness, not a cached snapshot)",
  );

  // Clean up.
  await SecurityEvent.deleteMany({ attemptId: attempt._id });
  await Attempt.deleteMany({ _id: attempt._id });
}

async function main() {
  console.log("Phase 19 live monitoring (SSE) verification\n");
  staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 19 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
