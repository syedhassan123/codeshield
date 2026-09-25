/**
 * Phase 16 certificate issuance checks.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase16-certificates.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  backfillMissingCertificates,
  issueCertificateIfEligible,
} from "../src/lib/certificates/issue";
import {
  getOwnedCertificate,
  listCertificatesForStudent,
} from "../src/lib/certificates/queries";
import { Assessment } from "../src/models/Assessment";
import { Certificate } from "../src/models/Certificate";
import { Result } from "../src/models/Result";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

function staticChecks() {
  // Mock data removed repo-wide, not just the one page.
  const mockData = read("src/lib/mock-data.ts");
  assert(!mockData.includes("mockCertificates"), "mockCertificates export removed from mock-data.ts");

  const listPage = read("src/app/student/certificates/page.tsx");
  assert(!listPage.includes("mockCertificates"), "list page no longer imports mockCertificates");
  assert(
    listPage.includes("listCertificatesForStudent"),
    "list page wired to real query",
  );

  const detailPage = read("src/app/student/certificates/[id]/page.tsx");
  assert(!detailPage.includes("mockCertificates"), "detail page no longer imports mockCertificates");
  assert(
    detailPage.includes("getOwnedCertificate"),
    "detail/print route independently enforces ownership",
  );
  assert(
    detailPage.includes("requirePageRole"),
    "detail/print route requires an authenticated student session",
  );

  const queries = read("src/lib/certificates/queries.ts");
  assert(
    queries.includes("studentId: new mongoose.Types.ObjectId(studentId)"),
    "list query scopes by studentId (ownership on the list route)",
  );

  const certModel = read("src/models/Certificate.ts");
  assert(
    /resultId:\s*\{[\s\S]*?unique:\s*true/.test(certModel),
    "Certificate.resultId has a unique DB-level index",
  );
  assert(
    /certificateSerial:\s*\{[\s\S]*?unique:\s*true/.test(certModel),
    "Certificate.certificateSerial has a unique DB-level index",
  );

  const issueSrc = read("src/lib/certificates/issue.ts");
  assert(
    issueSrc.includes("randomBytes"),
    "certificateSerial uses cryptographically random bytes (non-sequential/guessable)",
  );
  assert(
    issueSrc.includes("MONGO_DUPLICATE_KEY_ERROR_CODE"),
    "issuance treats a unique-index duplicate-key error as the idempotency guard",
  );

  const finalizeSrc = read("src/lib/exam/finalize.ts");
  assert(
    finalizeSrc.includes("issueCertificateIfEligible"),
    "finalizeAttempt checks certificate eligibility",
  );
  const gradingSrc = read("src/lib/actions/grading.ts");
  assert(
    gradingSrc.includes("issueCertificateIfEligible"),
    "manual grading paths check certificate eligibility too",
  );
}

async function dbChecks() {
  await connectDB();
  await Certificate.syncIndexes();

  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();
  const demo = await User.findOne({ email: "demo@codeshield.ai" }).lean();
  assert(rohan?._id && demo?._id, "seed students exist");

  const assessment = await Assessment.findOne({ code: "ASM-201" });
  assert(assessment, "published ASM-201 exists");

  type ResultOverrides = {
    evaluationStatus?: "completed" | "pending";
    finalScore?: number;
    objectiveScore?: number;
    totalMarks?: number;
  };

  function makeResult(overrides: ResultOverrides = {}) {
    return {
      attemptId: new mongoose.Types.ObjectId(),
      studentId: rohan!._id,
      assessmentId: assessment!._id,
      assessmentTitle: assessment!.title,
      objectiveScore: overrides.objectiveScore ?? 60,
      objectiveMaxMarks: 100,
      subjectiveScore: 0,
      subjectiveMaxMarks: 0,
      codingScore: 0,
      codingMaxMarks: 0,
      subjectivePendingCount: 0,
      finalScore: overrides.finalScore ?? 60,
      totalMarks: overrides.totalMarks ?? 100,
      evaluationStatus: overrides.evaluationStatus ?? "completed",
      questions: [],
      submittedAt: new Date(),
      finalizedReason: "submitted" as const,
    };
  }

  const createdResultIds: mongoose.Types.ObjectId[] = [];
  async function createResult(overrides: ResultOverrides = {}) {
    const doc = await Result.create(makeResult(overrides));
    createdResultIds.push(doc._id);
    return doc;
  }

  try {
    // 1) Completed + passing (60/100 = 60%, default threshold 60%) -> issues.
    const passing = await createResult();
    const outcome = await issueCertificateIfEligible(passing);
    assert(outcome?.created === true, "completed passing Result auto-issues a certificate");
    const cert = await Certificate.findOne({ resultId: passing._id });
    assert(!!cert, "certificate persisted for passing Result");
    assert(
      /^CERT-\d{4}-[A-Za-z0-9_-]+$/.test(cert!.certificateSerial),
      "certificate serial follows the non-sequential CERT-{year}-{random} format",
    );

    // 2) Idempotency: sequential re-run does not duplicate.
    const second = await issueCertificateIfEligible(passing);
    assert(second?.created === false, "re-running issuance on the same Result is a no-op");
    const countAfterSecond = await Certificate.countDocuments({ resultId: passing._id });
    assert(countAfterSecond === 1, "no duplicate certificate after sequential re-run");

    // 2b) Idempotency under a simulated concurrent double-call.
    const concurrentResult = await createResult({ finalScore: 75 });
    const [a, b] = await Promise.all([
      issueCertificateIfEligible(concurrentResult),
      issueCertificateIfEligible(concurrentResult),
    ]);
    assert(Boolean(a) && Boolean(b), "both concurrent calls resolve without throwing");
    const concurrentCount = await Certificate.countDocuments({
      resultId: concurrentResult._id,
    });
    assert(
      concurrentCount === 1,
      "concurrent double-issue race still yields exactly one certificate",
    );

    // 3) Boundary: score exactly equal to threshold issues.
    const boundary = await createResult({
      objectiveScore: 60,
      finalScore: 60,
      totalMarks: 100,
    });
    const boundaryOutcome = await issueCertificateIfEligible(boundary);
    assert(
      boundaryOutcome?.created === true,
      "score exactly at the pass threshold issues (boundary is inclusive >=)",
    );

    // 4) Below threshold -> no certificate.
    const failing = await createResult({
      objectiveScore: 40,
      finalScore: 40,
      totalMarks: 100,
    });
    const failingOutcome = await issueCertificateIfEligible(failing);
    assert(failingOutcome === null, "below-threshold passing score does not issue a certificate");

    // 5) Not completed yet -> no certificate, even with a passing score.
    const pending = await createResult({
      evaluationStatus: "pending",
      finalScore: 90,
    });
    const pendingOutcome = await issueCertificateIfEligible(pending);
    assert(
      pendingOutcome === null,
      "evaluationStatus !== completed does not issue a certificate regardless of score",
    );

    // 6) Cross-student access rejected on both the list and detail routes.
    const ownCert = await getOwnedCertificate(cert!._id.toString(), rohan!._id.toString());
    assert(ownCert?.id === cert!._id.toString(), "owning student can load their certificate");

    const foreignAccess = await getOwnedCertificate(
      cert!._id.toString(),
      demo!._id.toString(),
    );
    assert(foreignAccess === null, "cross-student certificate access is rejected (detail route)");

    const demoList = await listCertificatesForStudent(demo!._id.toString());
    assert(
      !demoList.some((c) => c.id === cert!._id.toString()),
      "cross-student certificate does not leak into another student's list",
    );

    const malformed = await getOwnedCertificate("not-a-valid-id", rohan!._id.toString());
    assert(malformed === null, "malformed certificate id is rejected, not thrown");

    // 7) Backfill: pre-existing qualifying Result (created before this
    // phase "shipped", i.e. with no certificate yet) gets exactly one
    // certificate issued, and re-running the backfill does not duplicate it.
    const preExisting = await createResult({ finalScore: 82 });
    const before = await backfillMissingCertificates(Result);
    assert(before.scanned >= 1, "backfill scans at least the seeded completed Results");
    const preCert = await Certificate.findOne({ resultId: preExisting._id });
    assert(!!preCert, "backfill issues a certificate for the pre-existing qualifying Result");
    const preCertCount = await Certificate.countDocuments({ resultId: preExisting._id });
    assert(preCertCount === 1, "backfill issues exactly one certificate for that Result");

    const after = await backfillMissingCertificates(Result);
    assert(after.issued === 0, "re-running backfill issues nothing new (fully idempotent)");
  } finally {
    // Clean up everything this run created — never leave verify-script
    // residue behind for the demo accounts.
    await Certificate.deleteMany({ resultId: { $in: createdResultIds } });
    await Result.deleteMany({ _id: { $in: createdResultIds } });
  }
}

async function main() {
  console.log("Phase 16 certificate issuance verification\n");
  staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 16 certificate issuance checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
