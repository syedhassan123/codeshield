import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { debugLog } from "@/lib/debug";
import { resolvePassThreshold } from "@/lib/certificates/config";
import { notifyCertificateIssued } from "@/lib/notifications/events";
import { Assessment } from "@/models/Assessment";
import { Certificate, type CertificateDocument } from "@/models/Certificate";
import type { ResultDocument } from "@/models/Result";

/** Minimal shape needed to decide/issue a certificate — accepts a full
 * ResultDocument or a plain object with the same fields. */
export type CertificateEligibleResult = Pick<
  ResultDocument,
  | "_id"
  | "studentId"
  | "assessmentId"
  | "assessmentTitle"
  | "attemptId"
  | "finalScore"
  | "totalMarks"
  | "evaluationStatus"
>;

const MONGO_DUPLICATE_KEY_ERROR_CODE = 11000;

/**
 * Non-sequential, cryptographically random serial — never derived from an
 * incrementing counter or the Mongo _id (that would let a serial be
 * enumerated to discover other students' certificates).
 */
function generateCertificateSerial(): string {
  const year = new Date().getFullYear();
  const random = randomBytes(9).toString("base64url");
  return `CERT-${year}-${random}`;
}

export type IssueCertificateOutcome = {
  certificate: CertificateDocument;
  created: boolean;
};

/**
 * Auto-issue a certificate for a completed, passing Result.
 *
 * Retake policy (explicit): one certificate per passing Result — a student
 * who retakes and re-passes the same assessment accumulates another
 * certificate; this does NOT dedupe by assessmentId+studentId.
 *
 * Idempotency is enforced by the unique DB index on Certificate.resultId.
 * The findOne-first check is only an optimization; the real guard is the
 * duplicate-key catch below, which is safe under concurrent/retried calls
 * (e.g. two near-simultaneous grading saves finishing the same Result).
 */
export async function issueCertificateIfEligible(
  result: CertificateEligibleResult,
): Promise<IssueCertificateOutcome | null> {
  if (result.evaluationStatus !== "completed") return null;
  if (!result.totalMarks || result.totalMarks <= 0) return null;

  const existing = await Certificate.findOne({ resultId: result._id });
  if (existing) {
    return { certificate: existing, created: false };
  }

  const percent = (result.finalScore / result.totalMarks) * 100;

  const assessment = await Assessment.findById(result.assessmentId).select(
    "passThreshold",
  );
  const passThreshold = resolvePassThreshold(
    assessment?.passThreshold ?? null,
  );

  if (percent < passThreshold) return null;

  try {
    const certificate = await Certificate.create({
      studentId: result.studentId,
      resultId: result._id,
      attemptId: result.attemptId,
      assessmentId: result.assessmentId,
      assessmentTitle: result.assessmentTitle,
      score: Math.round(percent * 100) / 100,
      passThreshold,
      certificateSerial: generateCertificateSerial(),
      issuedAt: new Date(),
      status: "issued",
    });

    debugLog("CERTIFICATE", "issued", {
      resultId: result._id.toString().slice(0, 8),
      score: percent.toFixed(1),
      passThreshold,
    });

    // Phase 20: notify the student in-app. Best-effort — never blocks
    // issuance if it fails (see createNotification).
    await notifyCertificateIssued({
      studentId: result.studentId,
      certificateId: certificate._id.toString(),
      assessmentTitle: result.assessmentTitle,
    });

    return { certificate, created: true };
  } catch (error) {
    const code = (error as { code?: number } | undefined)?.code;
    if (code === MONGO_DUPLICATE_KEY_ERROR_CODE) {
      // Lost a race to another concurrent/retried finalize/grade call —
      // the other call's certificate is the source of truth.
      const raced = await Certificate.findOne({ resultId: result._id });
      if (raced) return { certificate: raced, created: false };
    }
    throw error;
  }
}

/**
 * One-time backfill for Results that completed before Phase 16 shipped.
 * Uses the same idempotent issuance path, so it is safe to re-run.
 */
export async function backfillMissingCertificates(
  ResultModel: mongoose.Model<ResultDocument>,
): Promise<{ scanned: number; issued: number }> {
  const results = await ResultModel.find({
    evaluationStatus: "completed",
    totalMarks: { $gt: 0 },
  }).select(
    "_id studentId assessmentId assessmentTitle attemptId finalScore totalMarks evaluationStatus",
  );

  let issued = 0;
  for (const result of results) {
    const outcome = await issueCertificateIfEligible(result);
    if (outcome?.created) issued += 1;
  }

  return { scanned: results.length, issued };
}
