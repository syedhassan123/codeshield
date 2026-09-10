/**
 * Phase 14.4 interview evaluation workflow checks.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase14-4-evaluations.ts
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { ActionError } from "../src/lib/auth-guards";
import { connectDB } from "../src/lib/db";
import { submitOwnedInterviewEvaluation } from "../src/lib/interviewer/evaluations";
import {
  countPendingInterviewerEvaluations,
  getEvaluationFormContext,
  getOwnedInterviewEvaluation,
  isValidObjectId,
  listCompletedInterviewerEvaluations,
  listPendingInterviewerEvaluations,
} from "../src/lib/interviewer/queries";
import { Interview } from "../src/models/Interview";
import { InterviewEvaluation } from "../src/models/InterviewEvaluation";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

async function staticChecks() {
  assert(
    fs.existsSync("src/models/InterviewEvaluation.ts"),
    "InterviewEvaluation model exists",
  );

  const modelSrc = read("src/models/InterviewEvaluation.ts");
  assert(modelSrc.includes("interviewId"), "evaluation model has interviewId");
  assert(modelSrc.includes("unique: true"), "interviewId unique constraint exists");

  const evalPage = read("src/app/interviewer/(portal)/evaluations/page.tsx");
  assert(
    !evalPage.includes("mockEvaluations"),
    "evaluations page does not import mockEvaluations",
  );
  assert(
    evalPage.includes("listInterviewerEvaluations"),
    "evaluations page uses real query layer",
  );

  const actionSrc = read("src/lib/actions/interviewer.ts");
  assert(
    actionSrc.includes("submitInterviewEvaluationAction"),
    "submit evaluation action exists",
  );
  assert(
    !actionSrc.includes("completeEvaluationAction"),
    "does not reuse exam grading evaluation action",
  );
}

async function dbChecks() {
  await connectDB();

  const kabir = await User.findOne({ email: "kabir@codeshield.ai" }).lean();
  const riya = await User.findOne({ email: "riya@codeshield.ai" }).lean();
  const demo = await User.findOne({ email: "demo@codeshield.ai" }).lean();
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();

  const admin = await User.findOne({ email: "admin@codeshield.ai" }).lean();
  assert(kabir?._id && riya?._id && demo?._id && rohan?._id && admin?._id, "seed users exist");

  const kabirId = kabir!._id.toString();

  const pending = await listPendingInterviewerEvaluations(kabirId);
  const completed = await listCompletedInterviewerEvaluations(kabirId);
  assert(completed.length >= 1, "kabir has completed evaluations");

  const pendingCount = await countPendingInterviewerEvaluations(kabirId);
  assert(pendingCount >= pending.length, "pending count includes all pending rows");

  let submitTarget = await Interview.findOne({
    interviewerId: kabir!._id,
    status: "completed",
    _id: {
      $nin: (
        await InterviewEvaluation.find({ interviewerId: kabir!._id })
          .select("interviewId")
          .lean()
      ).map((row) => row.interviewId),
    },
  }).lean();

  if (!submitTarget) {
    submitTarget = await Interview.create({
      candidateId: rohan!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Evaluation Verification Interview",
      type: "Technical",
      scheduledAt: new Date(Date.now() - 2 * 86400000),
      durationMin: 45,
      status: "completed",
      meetingUrl: null,
    });
  }

  const pendingAfterEnsure = await listPendingInterviewerEvaluations(kabirId);
  assert(pendingAfterEnsure.length >= 1, "kabir has pending evaluations");

  const scheduledInterview = await Interview.findOne({
    interviewerId: kabir!._id,
    status: "scheduled",
  }).lean();
  assert(scheduledInterview?._id, "scheduled interview exists for eligibility test");

  const scheduledContext = await getEvaluationFormContext(
    scheduledInterview!._id.toString(),
    kabirId,
  );
  assert(scheduledContext === null, "scheduled interview is not evaluable");

  const cancelledInterview = await Interview.findOne({
    interviewerId: kabir!._id,
    status: "cancelled",
  }).lean();
  if (cancelledInterview) {
    const cancelledContext = await getEvaluationFormContext(
      cancelledInterview._id.toString(),
      kabirId,
    );
    assert(cancelledContext === null, "cancelled interview is not evaluable");
  }

  const riyaInterview = await Interview.findOne({
    interviewerId: riya!._id,
    status: "completed",
  }).lean();
  if (riyaInterview) {
    const foreignContext = await getEvaluationFormContext(
      riyaInterview._id.toString(),
      kabirId,
    );
    assert(foreignContext === null, "kabir cannot open riya completed interview evaluation");
  }

  assert(
    !isValidObjectId("not-a-valid-id"),
    "invalid interview id rejected safely",
  );
  const badContext = await getEvaluationFormContext("not-a-valid-id", kabirId);
  assert(badContext === null, "malformed id returns null evaluation context");

  // Submit evaluation for a completed interview without an evaluation yet
  const pendingInterviewId = submitTarget._id.toString();
  const submitOnce = await submitOwnedInterviewEvaluation(kabirId, {
    interviewId: pendingInterviewId,
    score: 82,
    notes: "Solid technical depth.",
  });
  assert(submitOnce.score === 82, "evaluation submits successfully");

  const submitTwice = await submitOwnedInterviewEvaluation(kabirId, {
    interviewId: pendingInterviewId,
    score: 99,
    notes: "Should not overwrite.",
  });
  assert(submitTwice.score === 82, "duplicate submit is idempotent");

  const saved = await getOwnedInterviewEvaluation(pendingInterviewId, kabirId);
  assert(saved?.score === 82, "duplicate submit does not overwrite canonical evaluation");

  const evalCount = await InterviewEvaluation.countDocuments({
    interviewId: submitTarget._id,
  });
  assert(evalCount === 1, "only one evaluation exists per interview");

  const afterPending = await listPendingInterviewerEvaluations(kabirId);
  assert(
    !afterPending.some((row) => row.interviewId === pendingInterviewId),
    "submitted interview leaves pending list",
  );

  const afterCompleted = await listCompletedInterviewerEvaluations(kabirId);
  assert(
    afterCompleted.some((row) => row.interviewId === pendingInterviewId),
    "submitted interview appears in completed list",
  );

  // Cleanup is not required — idempotent verification data is acceptable in dev DB.
  void ActionError;
}

async function main() {
  console.log("Phase 14.4 evaluation verification\n");
  await staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 14.4 evaluation checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
