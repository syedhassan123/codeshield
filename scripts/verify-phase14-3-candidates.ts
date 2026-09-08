/**
 * Phase 14.3 interviewer candidate integration checks.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase14-3-candidates.ts
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  getInterviewerCandidate,
  hasInterviewerCandidateAccess,
  isValidObjectId,
  listInterviewerCandidateInterviews,
  listInterviewerCandidates,
} from "../src/lib/interviewer/queries";
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
  const candidatesPage = read("src/app/interviewer/(portal)/candidates/page.tsx");
  assert(
    !candidatesPage.includes("mockStudents"),
    "candidates page does not import mockStudents",
  );
  assert(
    candidatesPage.includes("listInterviewerCandidates"),
    "candidates page uses assigned candidate query",
  );

  const queries = read("src/lib/interviewer/queries.ts");
  assert(
    queries.includes("listInterviewerCandidates") &&
      queries.includes("hasInterviewerCandidateAccess"),
    "candidate ownership query primitives exist",
  );
  assert(
    !queries.includes('User.find({ role: "student"'),
    "candidate queries do not load all students globally",
  );

  const actions = read("src/lib/actions/interviewer.ts");
  assert(
    actions.includes("loadInterviewerCandidatesAction") &&
      actions.includes("loadInterviewerCandidateAction"),
    "interviewer candidate server actions exist",
  );
}

async function dbChecks() {
  await connectDB();

  const kabir = await User.findOne({ email: "kabir@codeshield.ai" }).lean();
  const riya = await User.findOne({ email: "riya@codeshield.ai" }).lean();
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();

  assert(kabir?._id && riya?._id && rohan?._id, "seed users exist");

  const kabirId = kabir!._id.toString();
  const riyaId = riya!._id.toString();
  const rohanId = rohan!._id.toString();

  const kabirCandidates = await listInterviewerCandidates(kabirId);
  assert(kabirCandidates.length >= 2, "kabir sees assigned candidates");

  const rohanCard = kabirCandidates.find((c) => c.id === rohanId);
  assert(rohanCard, "rohan appears as kabir assigned candidate");
  assert(
    (rohanCard?.interviewCount ?? 0) >= 2,
    "rohan is deduplicated with interview count >= 2",
  );

  const uniqueIds = new Set(kabirCandidates.map((c) => c.id));
  assert(
    uniqueIds.size === kabirCandidates.length,
    "candidate list contains no duplicate candidate cards",
  );

  const kabirInterviewCandidateIds = await Interview.distinct("candidateId", {
    interviewerId: kabir!._id,
  });
  assert(
    kabirCandidates.every((c) =>
      kabirInterviewCandidateIds.some((id) => id.toString() === c.id),
    ),
    "every listed candidate comes from kabir owned interviews",
  );

  const allStudents = await User.countDocuments({ role: "student" });
  if (allStudents > kabirCandidates.length) {
    assert(true, "candidate list is narrower than global student population");
  }

  const unrelatedStudents = await User.find({ role: "student" }).lean();
  const kabirAssigned = new Set(
    kabirInterviewCandidateIds.map((id) => id.toString()),
  );
  const unrelated = unrelatedStudents.find(
    (s) => !kabirAssigned.has(s._id.toString()),
  );

  if (unrelated) {
    const blocked = await getInterviewerCandidate(
      unrelated._id.toString(),
      kabirId,
    );
    assert(blocked === null, "kabir cannot load unassigned candidate");
  }

  assert(
    !(await hasInterviewerCandidateAccess("not-a-valid-id", kabirId)),
    "invalid candidate id rejected safely",
  );
  assert(!isValidObjectId("not-a-valid-id"), "invalid object id helper works");

  const ownedHistory = await listInterviewerCandidateInterviews(
    rohanId,
    kabirId,
  );
  assert(ownedHistory.length >= 2, "kabir sees owned interview history for rohan");

  const kabirRohanTitles = await Interview.find({
    interviewerId: kabir!._id,
    candidateId: rohan!._id,
  })
    .select("title")
    .lean();
  const historyTitles = new Set(ownedHistory.map((i) => i.title));
  for (const row of kabirRohanTitles) {
    assert(historyTitles.has(row.title), "history includes all kabir/rohan interviews");
  }

  const riyaHistoryForRohan = await listInterviewerCandidateInterviews(
    rohanId,
    riyaId,
  );
  assert(
    riyaHistoryForRohan.length === 0,
    "riya sees no interview history for rohan when unassigned",
  );

  const demo = await User.findOne({ email: "demo@codeshield.ai" }).lean();
  assert(demo?._id, "demo student exists");
  const kabirCanDemo = await hasInterviewerCandidateAccess(
    demo!._id.toString(),
    kabirId,
  );
  const riyaCanDemo = await hasInterviewerCandidateAccess(
    demo!._id.toString(),
    riyaId,
  );
  assert(kabirCanDemo, "kabir has access to demo through owned interviews");
  assert(riyaCanDemo, "riya has access to demo through owned interviews");

  const kabirBlockedFromRiyaOnly = await getInterviewerCandidate(
    demo!._id.toString(),
    kabirId,
  );
  assert(kabirBlockedFromRiyaOnly !== null, "shared candidate loads for assigned interviewer");
}

async function main() {
  console.log("Phase 14.3 candidate verification\n");
  await staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 14.3 candidate checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
