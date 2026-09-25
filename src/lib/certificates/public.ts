import { Certificate } from "@/models/Certificate";
import { User } from "@/models/User";

export type PublicCertificateVerification =
  | {
      valid: true;
      status: "issued";
      studentName: string;
      assessmentTitle: string;
      score: number;
      issuedAt: string;
      certificateSerial: string;
    }
  | {
      valid: false;
      status: "revoked" | "not_found";
      certificateSerial: string;
    };

/**
 * Public, unauthenticated lookup by serial only — this is the one place in
 * the codebase deliberately designed to be called by anonymous visitors
 * (e.g. an employer verifying a candidate's certificate). Keep the returned
 * fields minimal: no student email, no internal Mongo ids, no
 * `revokedReason` (may contain internal admin notes not meant for the
 * public). "not found" and "revoked" are distinct so a legitimate revoked
 * certificate doesn't look identical to a typo — but neither leaks more
 * than that.
 */
export async function verifyCertificateBySerial(
  serial: string,
): Promise<PublicCertificateVerification> {
  const trimmed = serial.trim();
  if (!trimmed) {
    return { valid: false, status: "not_found", certificateSerial: trimmed };
  }

  const certificate = await Certificate.findOne({
    certificateSerial: trimmed,
  });

  if (!certificate) {
    return { valid: false, status: "not_found", certificateSerial: trimmed };
  }

  if (certificate.status === "revoked") {
    return {
      valid: false,
      status: "revoked",
      certificateSerial: certificate.certificateSerial,
    };
  }

  const student = await User.findById(certificate.studentId).select("name");

  return {
    valid: true,
    status: "issued",
    studentName: student?.name ?? "Unknown",
    assessmentTitle: certificate.assessmentTitle,
    score: certificate.score,
    issuedAt: certificate.issuedAt.toISOString(),
    certificateSerial: certificate.certificateSerial,
  };
}
