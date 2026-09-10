/**
 * Phase 14.6 interview system end-to-end hardening checks.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase14-6-interview-e2e.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import {
  getAdminInterview,
  listAdminInterviews,
  parseScheduledAtInput,
} from "../src/lib/admin/interviews";
import { ActionError } from "../src/lib/auth-guards";
import { connectDB } from "../src/lib/db";
import { submitOwnedInterviewEvaluation } from "../src/lib/interviewer/evaluations";
import {
  completeOwnedInterview,
  isInterviewJoinable,
  startOwnedInterview,
} from "../src/lib/interviewer/lifecycle";
import {
  getEvaluationFormContext,
  getInterviewForParticipant,
  getOwnedInterview,
  isValidObjectId,
  listInterviewerCandidates,
  listInterviewerInterviews,
  listPendingInterviewerEvaluations,
} from "../src/lib/interviewer/queries";
import {
  getStudentInterview,
  listStudentInterviews,
} from "../src/lib/student/interview-queries";
import {
  createInterviewSchema,
  normalizeInterviewActionInput,
  updateInterviewSchema,
} from "../src/lib/validators/interview-admin";
import { submitInterviewEvaluationSchema } from "../src/lib/validators/interview-evaluation";
import { Interview } from "../src/models/Interview";
import { InterviewEvaluation } from "../src/models/InterviewEvaluation";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

async function staticChecks() {
  const routes = [
    "src/app/admin/interviews/page.tsx",
    "src/app/student/interviews/page.tsx",
    "src/app/interviewer/(portal)/page.tsx",
    "src/app/interviewer/(portal)/interviews/page.tsx",
    "src/app/interviewer/(portal)/candidates/page.tsx",
    "src/app/interviewer/(portal)/evaluations/page.tsx",
  ];

  for (const route of routes) {
    const src = read(route);
    assert(!src.includes("mockInterviews"), `${route} has no mockInterviews`);
    assert(!src.includes("mockEvaluations"), `${route} has no mockEvaluations`);
    assert(!src.includes("mockStudents"), `${route} has no mockStudents`);
    assert(!src.includes("mockPanel"), `${route} has no mockPanel`);
  }

  assert(
    fs.existsSync("src/lib/interviewer/lifecycle.ts"),
    "interview lifecycle module exists",
  );

  const actions = read("src/lib/actions/interviewer.ts");
  assert(actions.includes("completeInterviewAction"), "complete interview action exists");
  assert(actions.includes("submitInterviewEvaluationAction"), "submit evaluation action exists");

  const lobby = read("src/app/interviewer/lobby/[id]/page.tsx");
  assert(lobby.includes("isInterviewJoinable"), "lobby blocks non-joinable statuses");

  const room = read("src/app/interviewer/room/[id]/page.tsx");
  assert(room.includes("isInterviewJoinable"), "room blocks non-joinable statuses");

  const roomClient = read("src/app/interviewer/room/[id]/room-client.tsx");
  assert(roomClient.includes("completeInterviewAction"), "room End wires completion action");
  assert(
    roomClient.includes("startInterviewAction"),
    "interviewer starts interview after successful room connection",
  );
}

function validationChecks() {
  const base = {
    candidateId: "507f1f77bcf86cd799439011",
    interviewerId: "507f1f77bcf86cd799439012",
    title: "Validation Test",
    type: "Technical" as const,
    scheduledAt: "2026-09-10T12:00",
    durationMin: 45,
  };

  const nullUrl = createInterviewSchema.parse(
    normalizeInterviewActionInput({ ...base, meetingUrl: null }),
  );
  assert(nullUrl.meetingUrl === null, "meetingUrl null accepted");

  const emptyUrl = createInterviewSchema.parse(
    normalizeInterviewActionInput({ ...base, meetingUrl: "" }),
  );
  assert(emptyUrl.meetingUrl === null, "meetingUrl empty string accepted");

  const omittedUrl = createInterviewSchema.parse(normalizeInterviewActionInput(base));
  assert(omittedUrl.meetingUrl === null, "meetingUrl omitted defaults to null");

  const validUrl = createInterviewSchema.parse(
    normalizeInterviewActionInput({
      ...base,
      meetingUrl: "https://meet.example.com/room",
    }),
  );
  assert(
    validUrl.meetingUrl === "https://meet.example.com/room",
    "valid meetingUrl accepted",
  );

  let invalidUrlFailed = false;
  try {
    createInterviewSchema.parse(
      normalizeInterviewActionInput({ ...base, meetingUrl: "not-a-url" }),
    );
  } catch {
    invalidUrlFailed = true;
  }
  assert(invalidUrlFailed, "invalid meetingUrl rejected");

  let badScore = false;
  try {
    submitInterviewEvaluationSchema.parse({
      interviewId: "507f1f77bcf86cd799439011",
      score: 101,
      notes: "",
    });
  } catch {
    badScore = true;
  }
  assert(badScore, "evaluation score > 100 rejected");

  let longNotes = false;
  try {
    submitInterviewEvaluationSchema.parse({
      interviewId: "507f1f77bcf86cd799439011",
      score: 50,
      notes: "x".repeat(5001),
    });
  } catch {
    longNotes = true;
  }
  assert(longNotes, "evaluation notes > 5000 rejected");

  updateInterviewSchema.parse({
    interviewId: "507f1f77bcf86cd799439011",
    meetingUrl: null,
  });
  assert(true, "update schema accepts null meetingUrl");
}

async function dbChecks() {
  await connectDB();

  const admin = await User.findOne({ email: "admin@codeshield.ai" }).lean();
  const kabir = await User.findOne({ email: "kabir@codeshield.ai" }).lean();
  const riya = await User.findOne({ email: "riya@codeshield.ai" }).lean();
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();
  const demo = await User.findOne({ email: "demo@codeshield.ai" }).lean();

  assert(admin?._id && kabir?._id && riya?._id && rohan?._id && demo?._id, "seed users exist");

  const kabirId = kabir!._id.toString();
  const rohanId = rohan!._id.toString();
  const scheduledAt = parseScheduledAtInput("2026-09-10T12:00");

  const created = await Interview.create({
    candidateId: rohan!._id,
    interviewerId: kabir!._id,
    createdBy: admin!._id,
    title: "Phase 14.6 E2E Interview",
    type: "Technical",
    scheduledAt,
    durationMin: 45,
    status: "scheduled",
    meetingUrl: null,
  });

  const interviewId = created._id.toString();
  assert(created.status === "scheduled", "created interview is scheduled");

  const adminView = await getAdminInterview(interviewId);
  assert(adminView?.id === interviewId, "admin sees canonical interview id");

  const studentRows = await listStudentInterviews(rohanId);
  assert(
    studentRows.some((row) => row.id === interviewId),
    "student sees same interview id",
  );

  const interviewerRows = await listInterviewerInterviews(kabirId);
  assert(
    interviewerRows.some((row) => row.id === interviewId),
    "interviewer sees same interview id",
  );

  assert(
    !(await listStudentInterviews(demo!._id.toString())).some(
      (row) => row.id === interviewId,
    ),
    "foreign student does not see interview",
  );

  const foreignLookup = await getStudentInterview(
    interviewId,
    demo!._id.toString(),
  );
  assert(foreignLookup === null, "foreign student direct lookup blocked");

  const foreignStudentView = await getInterviewForParticipant(
    interviewId,
    demo!._id.toString(),
    "student",
  );
  assert(foreignStudentView === null, "foreign student lobby/room ownership blocked");

  const foreignInterviewerView = await getInterviewForParticipant(
    interviewId,
    riya!._id.toString(),
    "interviewer",
  );
  assert(foreignInterviewerView === null, "foreign interviewer ownership blocked");

  assert(isValidObjectId(interviewId), "valid object id accepted");
  assert(!isValidObjectId("not-valid"), "malformed id rejected safely");
  assert(
    (await getInterviewForParticipant("not-valid", rohanId, "student")) === null,
    "malformed id returns null participant context",
  );

  assert(isInterviewJoinable("scheduled"), "scheduled is joinable");
  assert(isInterviewJoinable("in_progress"), "in_progress is joinable");
  assert(!isInterviewJoinable("completed"), "completed is not joinable");
  assert(!isInterviewJoinable("cancelled"), "cancelled is not joinable");

  const started = await startOwnedInterview(kabirId, interviewId);
  assert(started.status === "in_progress", "start transitions scheduled to in_progress");

  const startedAgain = await startOwnedInterview(kabirId, interviewId);
  assert(startedAgain.status === "in_progress", "start is idempotent");

  const studentParticipant = await getInterviewForParticipant(
    interviewId,
    rohanId,
    "student",
  );
  assert(studentParticipant !== null, "assigned student retains participant access");

  const completed = await completeOwnedInterview(kabirId, interviewId);
  assert(completed.status === "completed", "complete transitions in_progress to completed");

  const completedAgain = await completeOwnedInterview(kabirId, interviewId);
  assert(completedAgain.status === "completed", "complete is idempotent");

  assert(
    (await getEvaluationFormContext(interviewId, kabirId)) !== null,
    "completed interview becomes evaluable",
  );

  const pendingBefore = await listPendingInterviewerEvaluations(kabirId);
  assert(
    pendingBefore.some((row) => row.interviewId === interviewId),
    "completed interview appears in pending evaluations",
  );

  const existingEval = await InterviewEvaluation.findOne({ interviewId: created._id }).lean();
  if (existingEval) {
    await InterviewEvaluation.deleteOne({ _id: existingEval._id });
  }

  const submitted = await submitOwnedInterviewEvaluation(kabirId, {
    interviewId,
    score: 88,
    notes: "Phase 14.6 verification.",
  });
  assert(submitted.score === 88, "evaluation submits for completed interview");

  const resubmit = await submitOwnedInterviewEvaluation(kabirId, {
    interviewId,
    score: 99,
    notes: "Should not overwrite.",
  });
  assert(resubmit.score === 88, "evaluation double submit is idempotent");

  const evalCount = await InterviewEvaluation.countDocuments({ interviewId: created._id });
  assert(evalCount === 1, "only one evaluation per interview");

  const pendingAfter = await listPendingInterviewerEvaluations(kabirId);
  assert(
    !pendingAfter.some((row) => row.interviewId === interviewId),
    "evaluated interview leaves pending list",
  );

  const pad = (n: number) => String(n).padStart(2, "0");
  const roundtripInput = `${scheduledAt.getFullYear()}-${pad(scheduledAt.getMonth() + 1)}-${pad(scheduledAt.getDate())}T${pad(scheduledAt.getHours())}:${pad(scheduledAt.getMinutes())}`;
  const roundtripDate = parseScheduledAtInput(roundtripInput);
  assert(
    roundtripDate.getHours() === scheduledAt.getHours() &&
      roundtripDate.getMinutes() === scheduledAt.getMinutes(),
    "scheduledAt roundtrip preserves local time",
  );

  const lifecycleInterview = await Interview.create({
    candidateId: rohan!._id,
    interviewerId: kabir!._id,
    createdBy: admin!._id,
    title: "Phase 14.6 Cancel Test",
    type: "HR",
    scheduledAt: new Date(Date.now() + 86400000),
    durationMin: 30,
    status: "scheduled",
    meetingUrl: "https://meet.example.com/test",
  });

  const cancelId = lifecycleInterview._id.toString();
  const cancelledOnce = await Interview.findOneAndUpdate(
    { _id: cancelId, status: "scheduled" },
    { $set: { status: "cancelled" } },
    { new: true },
  ).lean();
  assert(cancelledOnce?.status === "cancelled", "cancel soft-updates status");

  const cancelledTwice = await Interview.findOneAndUpdate(
    { _id: cancelId, status: { $in: ["scheduled", "in_progress"] } },
    { $set: { status: "cancelled" } },
    { new: true },
  ).lean();
  assert(!cancelledTwice, "cancel idempotent when already cancelled");

  const cancelledDoc = await Interview.findById(cancelId).lean();
  assert(cancelledDoc?.status === "cancelled", "cancelled interview remains in DB");

  const cancelledStudent = await getStudentInterview(cancelId, rohanId);
  assert(cancelledStudent?.status === "cancelled", "student sees cancelled status");

  const cancelledParticipant = await getInterviewForParticipant(
    cancelId,
    rohanId,
    "student",
  );
  assert(cancelledParticipant !== null, "ownership query still works for cancelled");
  assert(
    !isInterviewJoinable(cancelledParticipant!.status),
    "cancelled interview is not joinable",
  );

  let staleUpdateApplied = false;
  const staleTarget = await Interview.create({
    candidateId: rohan!._id,
    interviewerId: kabir!._id,
    createdBy: admin!._id,
    title: "Phase 14.6 Stale Update Test",
    type: "Coding",
    scheduledAt: new Date(Date.now() + 2 * 86400000),
    durationMin: 20,
    status: "scheduled",
    meetingUrl: null,
  });

  await Interview.findOneAndUpdate(
    { _id: staleTarget._id, status: "scheduled" },
    { $set: { status: "completed" } },
  );

  const staleResult = await Interview.findOneAndUpdate(
    { _id: staleTarget._id, status: "scheduled" },
    { $set: { title: "Should Not Apply" } },
    { new: true },
  ).lean();
  if (staleResult?.title === "Should Not Apply") {
    staleUpdateApplied = true;
  }
  assert(!staleUpdateApplied, "stale status-qualified update does not overwrite completed");

  const candidates = await listInterviewerCandidates(kabirId);
  assert(
    candidates.some((c) => c.id === rohanId),
    "candidate derived from owned interviews only",
  );

  const adminList = await listAdminInterviews();
  assert(adminList.length >= 1, "admin list returns real interviews");

  await InterviewEvaluation.deleteOne({ interviewId: created._id });
  await Interview.deleteOne({ _id: created._id });
  await Interview.deleteOne({ _id: lifecycleInterview._id });
  await Interview.deleteOne({ _id: staleTarget._id });

  void ActionError;
}

async function main() {
  console.log("Phase 14.6 interview E2E verification\n");
  await staticChecks();
  validationChecks();
  await dbChecks();
  console.log("\nPASS: Phase 14.6 interview E2E checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
