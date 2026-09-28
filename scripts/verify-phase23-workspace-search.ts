/**
 * Phase 23 checks: the shared header search box queries real, role-scoped
 * MongoDB data instead of sitting decorative.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase23-workspace-search.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { searchWorkspace } from "../src/lib/search/queries";
import { Assessment } from "../src/models/Assessment";
import { Certificate } from "../src/models/Certificate";
import { Interview } from "../src/models/Interview";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

function staticChecks() {
  const shell = read("src/components/layout/workspace-shell.tsx");
  assert(
    shell.includes("WorkspaceSearch"),
    "workspace shell renders the real search component",
  );
  assert(
    !shell.includes('placeholder="Search..."'),
    "decorative Search... input is gone from the shell",
  );

  const client = read("src/components/layout/workspace-search.tsx");
  assert(
    client.includes("searchWorkspaceAction"),
    "search box calls the real search action",
  );
  assert(client.includes("onChange"), "search input is controlled");

  const actions = read("src/lib/actions/search.ts");
  assert(actions.includes("requireSession"), "search action requires a session");

  const queries = read("src/lib/search/queries.ts");
  assert(
    queries.includes("studentId") && queries.includes("interviewerId"),
    "student and interviewer queries are scoped to the signed-in user",
  );
  assert(
    queries.includes("escapeRegex"),
    "search escapes regex metacharacters",
  );
}

async function dbChecks() {
  await connectDB();

  const admin = await User.findOne({ email: "admin@codeshield.ai" });
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" });
  const demo = await User.findOne({ email: "demo@codeshield.ai" });
  const kabir = await User.findOne({ email: "kabir@codeshield.ai" });
  const riya = await User.findOne({ email: "riya@codeshield.ai" });
  assert(admin && rohan && demo && kabir && riya, "seed users exist");

  const empty = await searchWorkspace({
    role: "admin",
    userId: admin!._id.toString(),
    query: " ",
  });
  assert(empty.length === 0, "blank query returns no hits");

  const short = await searchWorkspace({
    role: "admin",
    userId: admin!._id.toString(),
    query: "P",
  });
  assert(short.length === 0, "a 1-character query returns no hits");

  const escaped = await searchWorkspace({
    role: "admin",
    userId: admin!._id.toString(),
    query: "python (",
  });
  assert(Array.isArray(escaped), "regex metacharacters do not throw");

  const adminHits = await searchWorkspace({
    role: "admin",
    userId: admin!._id.toString(),
    query: "Python",
  });
  assert(
    adminHits.some((hit) => hit.href.includes("/admin/assessments/")),
    "admin search finds an assessment and links to its detail page",
  );
  assert(
    adminHits.some((hit) => hit.group === "Questions" || hit.group === "Assessments"),
    "admin search returns grouped assessment/question hits",
  );

  const studentHits = await searchWorkspace({
    role: "admin",
    userId: admin!._id.toString(),
    query: "Rohan",
  });
  assert(
    studentHits.some((hit) => hit.group === "Students" && hit.title.includes("Rohan")),
    "admin search finds a student by name",
  );

  const draft = await Assessment.create({
    code: `ASM-SEARCH-${Date.now()}`,
    title: `Hidden Draft Search ${Date.now()}`,
    type: "mcq",
    category: "Programming",
    difficulty: "easy",
    status: "draft",
    durationMin: 30,
    totalMarks: 10,
    visibility: "all",
    createdBy: admin!._id,
  });

  const interview = await Interview.create({
    candidateId: demo!._id,
    interviewerId: kabir!._id,
    createdBy: admin!._id,
    title: `Search Probe Interview ${Date.now()}`,
    type: "Technical",
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    durationMin: 45,
    status: "scheduled",
  });

  const certificate = await Certificate.create({
    studentId: rohan!._id,
    resultId: new mongoose.Types.ObjectId(),
    attemptId: new mongoose.Types.ObjectId(),
    assessmentId: new mongoose.Types.ObjectId(),
    assessmentTitle: `Search Probe Cert ${Date.now()}`,
    score: 80,
    passThreshold: 60,
    certificateSerial: `CERT-2026-search${Date.now()}`,
    issuedAt: new Date(),
    status: "issued",
  });

  try {
    const studentDraftHits = await searchWorkspace({
      role: "student",
      userId: rohan!._id.toString(),
      query: draft.title,
    });
    assert(
      !studentDraftHits.some((hit) => hit.title === draft.title),
      "a student search does not see draft assessments",
    );

    const published = await Assessment.findOne({
      status: "published",
      code: "ASM-201",
    });
    assert(published, "published ASM-201 exists");
    const studentPublished = await searchWorkspace({
      role: "student",
      userId: rohan!._id.toString(),
      query: "Foundations",
    });
    assert(
      studentPublished.some(
        (hit) => hit.href === `/student/exam/${published!._id.toString()}`,
      ),
      "a student search finds a published assessment they can take",
    );

    const ownerCert = await searchWorkspace({
      role: "student",
      userId: rohan!._id.toString(),
      query: certificate.certificateSerial,
    });
    assert(
      ownerCert.some(
        (hit) => hit.href === `/student/certificates/${certificate._id.toString()}`,
      ),
      "the owning student can find their certificate by serial",
    );

    const otherCert = await searchWorkspace({
      role: "student",
      userId: demo!._id.toString(),
      query: certificate.certificateSerial,
    });
    assert(
      !otherCert.some((hit) => hit.id.includes(certificate._id.toString())),
      "another student cannot find someone else's certificate",
    );

    const ownerInterview = await searchWorkspace({
      role: "interviewer",
      userId: kabir!._id.toString(),
      query: interview.title,
    });
    assert(
      ownerInterview.some(
        (hit) => hit.href === `/interviewer/lobby/${interview._id.toString()}`,
      ),
      "the assigned interviewer can find their interview",
    );

    const otherInterview = await searchWorkspace({
      role: "interviewer",
      userId: riya!._id.toString(),
      query: interview.title,
    });
    assert(
      !otherInterview.some((hit) => hit.id.includes(interview._id.toString())),
      "another interviewer cannot find an interview they were not assigned",
    );
  } finally {
    await Assessment.deleteMany({ _id: draft._id });
    await Interview.deleteMany({ _id: interview._id });
    await Certificate.deleteMany({ _id: certificate._id });
  }
}

async function main() {
  console.log("Phase 23 workspace search verification\n");
  staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 23 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
