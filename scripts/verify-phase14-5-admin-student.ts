/**
 * Phase 14.5 admin + student interview integration checks.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase14-5-admin-student.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import {
  assertAssignableInterviewer,
  assertAssignableStudent,
  getAdminInterview,
  listAdminInterviews,
  parseScheduledAtInput,
} from "../src/lib/admin/interviews";
import { connectDB } from "../src/lib/db";
import {
  getEvaluationFormContext,
  getInterviewForParticipant,
  listInterviewerCandidates,
  listInterviewerInterviews,
} from "../src/lib/interviewer/queries";
import {
  countStudentInterviews,
  getStudentInterview,
  listStudentInterviews,
} from "../src/lib/student/interview-queries";
import { Interview } from "../src/models/Interview";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

async function staticChecks() {
  const adminPage = read("src/app/admin/interviews/page.tsx");
  assert(!adminPage.includes("mockInterviews"), "admin interviews page has no mockInterviews");
  assert(!adminPage.includes("mockPanel"), "admin interviews page has no mockPanel");

  const studentPage = read("src/app/student/interviews/page.tsx");
  assert(!studentPage.includes("mockInterviews"), "student interviews page has no mockInterviews");
  assert(studentPage.includes("listStudentInterviews"), "student interviews uses real queries");

  const actions = read("src/lib/actions/interviews-admin.ts");
  assert(actions.includes("requireAdmin()"), "admin interview actions require admin");
  assert(actions.includes("createdBy: session.user.id"), "createdBy is server-derived");
}

async function dbChecks() {
  await connectDB();

  const admin = await User.findOne({ email: "admin@codeshield.ai" }).lean();
  const kabir = await User.findOne({ email: "kabir@codeshield.ai" }).lean();
  const riya = await User.findOne({ email: "riya@codeshield.ai" }).lean();
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();
  const demo = await User.findOne({ email: "demo@codeshield.ai" }).lean();

  assert(admin?._id && kabir?._id && rohan?._id && demo?._id, "seed users exist");

  await assertAssignableStudent(rohan!._id.toString());
  await assertAssignableInterviewer(kabir!._id.toString());

  let invalidStudentFailed = false;
  try {
    await assertAssignableStudent(kabir!._id.toString());
  } catch {
    invalidStudentFailed = true;
  }
  assert(invalidStudentFailed, "interviewer cannot be assigned as candidate");

  const scheduledAt = parseScheduledAtInput(
    new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 16),
  );

  const created = await Interview.create({
    candidateId: rohan!._id,
    interviewerId: kabir!._id,
    createdBy: admin!._id,
    title: "Phase 14.5 Verification Interview",
    type: "Technical",
    scheduledAt,
    durationMin: 45,
    status: "scheduled",
    meetingUrl: null,
  });

  assert(created.createdBy.toString() === admin!._id.toString(), "createdBy persisted correctly");

  const adminView = await getAdminInterview(created._id.toString());
  assert(adminView?.title === "Phase 14.5 Verification Interview", "admin can load created interview");

  const studentRows = await listStudentInterviews(rohan!._id.toString());
  assert(
    studentRows.some((row) => row.id === created._id.toString()),
    "student sees own admin-created interview",
  );

  const demoRows = await listStudentInterviews(demo!._id.toString());
  assert(
    !demoRows.some((row) => row.id === created._id.toString()),
    "other student does not see foreign interview",
  );

  const foreignStudentView = await getStudentInterview(
    created._id.toString(),
    demo!._id.toString(),
  );
  assert(foreignStudentView === null, "student IDOR blocked on direct lookup");

  const interviewerRows = await listInterviewerInterviews(kabir!._id.toString());
  assert(
    interviewerRows.some((row) => row.id === created._id.toString()),
    "assigned interviewer sees admin-created interview",
  );

  const riyaRows = await listInterviewerInterviews(riya!._id.toString());
  assert(
    !riyaRows.some((row) => row.id === created._id.toString()),
    "other interviewer does not see foreign interview",
  );

  const candidates = await listInterviewerCandidates(kabir!._id.toString());
  assert(
    candidates.some((c) => c.id === rohan!._id.toString()),
    "candidate appears on interviewer candidates list",
  );

  const rescheduledAt = new Date(Date.now() + 5 * 86400000);
  await Interview.findOneAndUpdate(
    { _id: created._id, status: "scheduled" },
    {
      $set: {
        scheduledAt: rescheduledAt,
        title: "Phase 14.5 Rescheduled Interview",
      },
    },
  );

  const rescheduled = await getAdminInterview(created._id.toString());
  assert(
    rescheduled?.title === "Phase 14.5 Rescheduled Interview",
    "scheduled interview can be rescheduled",
  );

  await Interview.findOneAndUpdate(
    { _id: created._id, status: "scheduled" },
    { $set: { status: "cancelled" } },
  );
  const cancelled = await Interview.findById(created._id).lean();
  assert(cancelled?.status === "cancelled", "cancelled interview remains in DB");

  const studentCancelled = await getStudentInterview(
    created._id.toString(),
    rohan!._id.toString(),
  );
  assert(studentCancelled?.status === "cancelled", "student sees cancelled status");

  const completed = await Interview.findOne({
    interviewerId: kabir!._id,
    status: "completed",
  }).lean();
  if (completed) {
    const pendingContext = await getEvaluationFormContext(
      completed._id.toString(),
      kabir!._id.toString(),
    );
    assert(pendingContext !== null, "completed interview remains evaluable when owned");
  }

  const participant = await getInterviewForParticipant(
    created._id.toString(),
    rohan!._id.toString(),
    "student",
  );
  assert(participant !== null, "student participant guard allows own cancelled interview view");

  const rohanCount = await countStudentInterviews(rohan!._id.toString());
  assert(rohanCount >= 1, "student interview count includes assigned interviews");

  const allAdmin = await listAdminInterviews();
  assert(allAdmin.length >= 1, "admin list returns real interviews");

  await Interview.deleteOne({ _id: created._id });
}

async function main() {
  console.log("Phase 14.5 admin/student interview verification\n");
  await staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 14.5 admin/student checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
