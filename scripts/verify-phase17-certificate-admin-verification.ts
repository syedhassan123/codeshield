/**
 * Phase 17 checks: public certificate verification + admin
 * management/revocation, extending Phase 16.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase17-certificate-admin-verification.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  listAdminCertificates,
  reinstateCertificate,
  revokeCertificate,
} from "../src/lib/certificates/admin-queries";
import { verifyCertificateBySerial } from "../src/lib/certificates/public";
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
  const publicLib = read("src/lib/certificates/public.ts");
  const typeMatch = publicLib.match(
    /export type PublicCertificateVerification =([\s\S]*?);\n\n/,
  );
  assert(!!typeMatch, "PublicCertificateVerification type is declared");
  const publicShape = typeMatch![1];
  assert(
    !publicShape.includes("revokedReason"),
    "public verification response shape never includes revokedReason (internal admin notes)",
  );
  assert(
    !publicShape.includes("studentId") && !publicShape.includes("email"),
    "public verification response shape does not expose internal ids or email",
  );

  const verifyPage = read("src/app/verify/[serial]/page.tsx");
  assert(
    !verifyPage.includes("requirePageRole") &&
      !verifyPage.includes("requireAdmin") &&
      !verifyPage.includes("requireStudent"),
    "public verify page has no auth gate (intentionally public)",
  );

  const adminActions = read("src/lib/actions/certificates-admin.ts");
  assert(
    adminActions.includes("requireAdmin"),
    "admin certificate actions require an admin session",
  );

  const adminPage = read("src/app/admin/certificates/page.tsx");
  assert(
    adminPage.includes('requirePageRole(["admin"])'),
    "admin certificates page is admin-gated",
  );

  const adminLayout = read("src/app/admin/layout.tsx");
  assert(
    adminLayout.includes("/admin/certificates"),
    "admin nav links to the certificates page",
  );
}

async function dbChecks() {
  await connectDB();

  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();
  const admin = await User.findOne({ email: "admin@codeshield.ai" }).lean();
  assert(rohan?._id && admin?._id, "seed users exist");

  const assessment = await Assessment.findOne({ code: "ASM-201" });
  assert(assessment, "published ASM-201 exists");

  const result = await Result.create({
    attemptId: new mongoose.Types.ObjectId(),
    studentId: rohan!._id,
    assessmentId: assessment!._id,
    assessmentTitle: assessment!.title,
    objectiveScore: 70,
    objectiveMaxMarks: 100,
    subjectiveScore: 0,
    subjectiveMaxMarks: 0,
    codingScore: 0,
    codingMaxMarks: 0,
    subjectivePendingCount: 0,
    finalScore: 70,
    totalMarks: 100,
    evaluationStatus: "completed",
    questions: [],
    submittedAt: new Date(),
    finalizedReason: "submitted" as const,
  });

  const certificate = await Certificate.create({
    studentId: rohan!._id,
    resultId: result._id,
    attemptId: result.attemptId,
    assessmentId: assessment!._id,
    assessmentTitle: assessment!.title,
    score: 70,
    passThreshold: 60,
    certificateSerial: `CERT-TEST-${new mongoose.Types.ObjectId().toString()}`,
    issuedAt: new Date(),
    status: "issued",
  });

  try {
    // 1) Public verification — valid certificate.
    const validLookup = await verifyCertificateBySerial(
      certificate.certificateSerial,
    );
    assert(validLookup.valid === true, "valid serial verifies successfully");
    if (validLookup.valid) {
      assert(
        validLookup.studentName === rohan!.name,
        "verification returns the correct student name",
      );
      assert(
        !("revokedReason" in validLookup),
        "issued-certificate verification payload has no revokedReason field",
      );
    }

    // 2) Public verification — unknown serial.
    const missingLookup = await verifyCertificateBySerial("CERT-DOES-NOT-EXIST");
    assert(
      missingLookup.valid === false && missingLookup.status === "not_found",
      "unknown serial returns not_found, not an error",
    );

    // 3) Admin revoke — then public verification reflects revoked, distinctly from not_found.
    const revoked = await revokeCertificate({
      certificateId: certificate._id.toString(),
      adminId: admin!._id.toString(),
      reason: "verify-phase17 test revoke",
    });
    assert(revoked?.status === "revoked", "admin revoke sets status to revoked");
    assert(!!revoked?.revokedAt, "revoke sets revokedAt");
    assert(
      revoked?.revokedBy?.toString() === admin!._id.toString(),
      "revoke records which admin revoked it",
    );

    const revokedLookup = await verifyCertificateBySerial(
      certificate.certificateSerial,
    );
    assert(
      revokedLookup.valid === false && revokedLookup.status === "revoked",
      "revoked certificate verifies as revoked, distinct from not_found",
    );

    // 4) Revoke is idempotent — revoking an already-revoked certificate is a no-op, not an error.
    const revokedAgain = await revokeCertificate({
      certificateId: certificate._id.toString(),
      adminId: admin!._id.toString(),
      reason: "second call should no-op",
    });
    assert(
      revokedAgain?.revokedReason === "verify-phase17 test revoke",
      "re-revoking an already-revoked certificate is a no-op (reason unchanged)",
    );

    // 5) Admin list — status filter surfaces the revoked certificate.
    const revokedList = await listAdminCertificates({
      search: certificate.certificateSerial,
      status: "revoked",
    });
    assert(
      revokedList.certificates.some((c) => c.id === certificate._id.toString()),
      "admin list finds the revoked certificate under the revoked filter",
    );
    const issuedOnlyList = await listAdminCertificates({
      search: certificate.certificateSerial,
      status: "issued",
    });
    assert(
      !issuedOnlyList.certificates.some(
        (c) => c.id === certificate._id.toString(),
      ),
      "revoked certificate does not appear under the issued-only filter",
    );

    // 6) Reinstate — status flips back, public verification is valid again, idempotent.
    const reinstated = await reinstateCertificate(certificate._id.toString());
    assert(reinstated?.status === "issued", "reinstate sets status back to issued");
    assert(reinstated?.revokedAt === null, "reinstate clears revokedAt");

    const reinstatedLookup = await verifyCertificateBySerial(
      certificate.certificateSerial,
    );
    assert(
      reinstatedLookup.valid === true,
      "reinstated certificate verifies as valid again",
    );

    const reinstatedAgain = await reinstateCertificate(
      certificate._id.toString(),
    );
    assert(
      reinstatedAgain?.status === "issued",
      "re-reinstating an already-issued certificate is a no-op",
    );

    // 7) Malformed/unknown ids never throw — they resolve to null.
    const malformedRevoke = await revokeCertificate({
      certificateId: "not-a-valid-id",
      adminId: admin!._id.toString(),
      reason: "should be rejected",
    });
    assert(malformedRevoke === null, "revoking a malformed certificate id returns null, not a throw");

    const unknownReinstate = await reinstateCertificate(
      new mongoose.Types.ObjectId().toString(),
    );
    assert(
      unknownReinstate === null,
      "reinstating a nonexistent certificate id returns null, not a throw",
    );
  } finally {
    await Certificate.deleteOne({ _id: certificate._id });
    await Result.deleteOne({ _id: result._id });
  }
}

async function main() {
  console.log("Phase 17 certificate verification + admin management checks\n");
  staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 17 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
