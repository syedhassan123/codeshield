/**
 * Phase 14.2 interviewer portal integration checks.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase14-2-interviewer.ts
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { ActionError } from "../src/lib/auth-guards";
import { connectDB } from "../src/lib/db";
import {
  loadInterviewerInterviewAction,
  loadInterviewerInterviewsAction,
} from "../src/lib/actions/interviewer";
import {
  endOfDay,
  endOfWeek,
  getInterviewerDashboardMetrics,
  getInterviewForParticipant,
  getOwnedInterview,
  isValidObjectId,
  listInterviewerInterviews,
  startOfDay,
  startOfWeek,
} from "../src/lib/interviewer/queries";
import { INTERVIEW_STATUSES, INTERVIEW_TYPES } from "../src/models/Interview";
import { Interview } from "../src/models/Interview";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function staticChecks() {
  const guards = read("src/lib/auth-guards.ts");
  assert(
    guards.includes("requireInterviewer"),
    "requireInterviewer guard exists",
  );

  const portalLayout = read("src/app/interviewer/(portal)/layout.tsx");
  assert(
    portalLayout.includes('requirePageRole(["interviewer"])'),
    "interviewer portal layout is role-gated",
  );

  const dashboard = read("src/app/interviewer/(portal)/page.tsx");
  assert(
    !dashboard.includes("mockInterviews") &&
      !dashboard.includes("mockEvaluations"),
    "dashboard no longer imports mock interview data",
  );

  const interviewsPage = read("src/app/interviewer/(portal)/interviews/page.tsx");
  assert(
    !interviewsPage.includes("mockInterviews"),
    "interviews page no longer imports mockInterviews",
  );

  const candidatesPage = read("src/app/interviewer/(portal)/candidates/page.tsx");
  assert(
    !candidatesPage.includes("mockStudents"),
    "candidates page no longer imports mockStudents",
  );

  const evaluationsPage = read(
    "src/app/interviewer/(portal)/evaluations/page.tsx",
  );
  assert(
    !evaluationsPage.includes("mockEvaluations"),
    "evaluations page no longer imports mockEvaluations",
  );

  const lobby = read("src/app/interviewer/lobby/[id]/page.tsx");
  assert(
    lobby.includes("getInterviewForParticipant"),
    "lobby loads owned/participant interview",
  );
  assert(lobby.includes("notFound()"), "lobby uses safe notFound");

  const room = read("src/app/interviewer/room/[id]/page.tsx");
  assert(
    room.includes("getInterviewForParticipant"),
    "room validates interview ownership/participation",
  );

  const modelSrc = read("src/models/Interview.ts");
  assert(modelSrc.includes("interviewerId"), "Interview model has interviewerId");
  assert(modelSrc.includes("candidateId"), "Interview model has candidateId");
  assert(
    INTERVIEW_TYPES.join(",") === "Coding,Technical,HR",
    "interview types match mock semantics",
  );
  assert(
    INTERVIEW_STATUSES.includes("scheduled") &&
      INTERVIEW_STATUSES.includes("in_progress") &&
      INTERVIEW_STATUSES.includes("completed") &&
      INTERVIEW_STATUSES.includes("cancelled"),
    "interview statuses are normalized",
  );
}

async function dbChecks() {
  await connectDB();

  const kabir = await User.findOne({ email: "kabir@codeshield.ai" }).lean();
  const riya = await User.findOne({ email: "riya@codeshield.ai" }).lean();
  assert(kabir?._id, "seed interviewer kabir exists");
  assert(riya?._id, "seed interviewer riya exists for IDOR tests");

  const kabirId = kabir!._id.toString();
  const riyaId = riya!._id.toString();

  const kabirInterviews = await Interview.find({ interviewerId: kabir!._id });
  assert(kabirInterviews.length >= 3, "kabir has seeded interviews");

  const foreignInterview = await Interview.findOne({
    interviewerId: riya!._id,
  }).lean();
  assert(foreignInterview?._id, "riya has at least one interview for IDOR test");

  const foreignId = foreignInterview!._id.toString();

  const owned = await getOwnedInterview(foreignId, kabirId);
  assert(owned === null, "kabir cannot load riya interview via getOwnedInterview");

  const participantMiss = await getInterviewForParticipant(
    foreignId,
    kabirId,
    "interviewer",
  );
  assert(
    participantMiss === null,
    "kabir cannot load riya interview via getInterviewForParticipant",
  );

  assert(!isValidObjectId("IVW-401"), "legacy mock id rejected as ObjectId");
  assert(!isValidObjectId("not-an-id"), "malformed id rejected");

  const badOwned = await getOwnedInterview("not-an-id", kabirId);
  assert(badOwned === null, "malformed id returns null safely");

  const metrics = await getInterviewerDashboardMetrics(kabirId);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);

  const expectedToday = await Interview.countDocuments({
    interviewerId: kabir!._id,
    scheduledAt: { $gte: todayStart, $lt: todayEnd },
    status: { $ne: "cancelled" },
  });
  const expectedWeek = await Interview.countDocuments({
    interviewerId: kabir!._id,
    scheduledAt: { $gte: weekStart, $lt: weekEnd },
    status: { $ne: "cancelled" },
  });
  const expectedCompleted = await Interview.countDocuments({
    interviewerId: kabir!._id,
    status: "completed",
  });

  assert(metrics.todayCount === expectedToday, "dashboard today count matches DB");
  assert(metrics.weekCount === expectedWeek, "dashboard week count matches DB");
  assert(
    metrics.completedCount === expectedCompleted,
    "dashboard completed count matches DB",
  );
  assert(metrics.avgRating === null, "avg rating remains unavailable");

  const listed = await listInterviewerInterviews(kabirId);
  assert(
    listed.every((item) =>
      kabirInterviews.some((doc) => doc._id.toString() === item.id),
    ),
    "interview list contains only kabir assigned records",
  );
  assert(listed.length === kabirInterviews.length, "list length matches assigned count");

  const ownedInterview = kabirInterviews[0]!;
  const loaded = await getOwnedInterview(ownedInterview._id.toString(), kabirId);
  assert(loaded?.id === ownedInterview._id.toString(), "owned interview loads");

  const student = await User.findOne({ email: "rohan@codeshield.edu" }).lean();
  assert(student?._id, "seed student exists");

  const studentOwned = await Interview.findOne({
    candidateId: student!._id,
    interviewerId: kabir!._id,
  }).lean();
  if (studentOwned) {
    const studentView = await getInterviewForParticipant(
      studentOwned._id.toString(),
      student!._id.toString(),
      "student",
    );
    assert(studentView !== null, "candidate can load own interview for lobby/room");
  }

  const studentForeign = await getInterviewForParticipant(
    foreignId,
    student!._id.toString(),
    "student",
  );
  assert(
    studentForeign === null,
    "student cannot load interview they are not assigned to",
  );
}

async function actionChecks() {
  // Server actions require auth session — verify error path without session is not possible here.
  // Statically confirm actions resolve interviewer from session, not client input.
  const actionSrc = read("src/lib/actions/interviewer.ts");
  assert(
    actionSrc.includes("requireInterviewer()") &&
      actionSrc.includes("session.user.id"),
    "interviewer actions derive identity from session",
  );
  assert(
    !actionSrc.includes("interviewerId:") ||
      !actionSrc.match(/function\s+\w+\(\s*interviewerId/),
    "interviewer actions do not accept interviewerId parameter",
  );

  // Document action contract without live session.
  void loadInterviewerInterviewsAction;
  void loadInterviewerInterviewAction;
}

async function main() {
  console.log("Phase 14.2 interviewer verification\n");
  await staticChecks();
  await dbChecks();
  await actionChecks();
  console.log("\nPASS: Phase 14.2 interviewer checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
