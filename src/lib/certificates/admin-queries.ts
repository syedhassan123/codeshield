import mongoose from "mongoose";
import { Certificate, type CertificateStatus } from "@/models/Certificate";
import { User } from "@/models/User";

export type AdminCertificateRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  assessmentTitle: string;
  score: number;
  passThreshold: number;
  certificateSerial: string;
  issuedAt: string;
  status: CertificateStatus;
  revokedAt: string | null;
  revokedReason: string;
};

export async function listAdminCertificates(options: {
  search?: string;
  status?: "all" | CertificateStatus;
  page?: number;
  pageSize?: number;
}) {
  const search = (options.search ?? "").trim();
  const status = options.status ?? "all";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));

  const query: Record<string, unknown> = {};
  if (status !== "all") query.status = status;

  if (search) {
    const matchingStudents = await User.find({
      role: "student",
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    query.$or = [
      { assessmentTitle: { $regex: search, $options: "i" } },
      { certificateSerial: { $regex: search, $options: "i" } },
      ...(matchingStudents.length
        ? [{ studentId: { $in: matchingStudents.map((s) => s._id) } }]
        : []),
    ];
  }

  const skip = (page - 1) * pageSize;
  const [total, certificates] = await Promise.all([
    Certificate.countDocuments(query),
    Certificate.find(query).sort({ issuedAt: -1 }).skip(skip).limit(pageSize),
  ]);

  if (!certificates.length) {
    return {
      certificates: [] as AdminCertificateRow[],
      total,
      page,
      pageSize,
      pageCount: 1,
    };
  }

  const studentIds = [
    ...new Set(certificates.map((c) => c.studentId.toString())),
  ];
  const students = await User.find({ _id: { $in: studentIds } }).select(
    "name email",
  );
  const studentMap = new Map(students.map((s) => [s._id.toString(), s]));

  const rows: AdminCertificateRow[] = certificates.map((c) => {
    const student = studentMap.get(c.studentId.toString());
    return {
      id: c._id.toString(),
      studentName: student?.name ?? "Unknown",
      studentEmail: student?.email ?? "",
      assessmentTitle: c.assessmentTitle,
      score: c.score,
      passThreshold: c.passThreshold,
      certificateSerial: c.certificateSerial,
      issuedAt: c.issuedAt.toISOString(),
      status: c.status,
      revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
      revokedReason: c.revokedReason ?? "",
    };
  });

  return {
    certificates: rows,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Idempotent: revoking an already-revoked certificate is a no-op, not an error. */
export async function revokeCertificate(options: {
  certificateId: string;
  adminId: string;
  reason: string;
}) {
  if (!mongoose.Types.ObjectId.isValid(options.certificateId)) return null;

  const certificate = await Certificate.findById(options.certificateId);
  if (!certificate) return null;
  if (certificate.status === "revoked") return certificate;

  certificate.status = "revoked";
  certificate.revokedAt = new Date();
  certificate.revokedBy = new mongoose.Types.ObjectId(options.adminId);
  certificate.revokedReason = options.reason;
  await certificate.save();
  return certificate;
}

/** Idempotent: reinstating an already-issued certificate is a no-op. */
export async function reinstateCertificate(certificateId: string) {
  if (!mongoose.Types.ObjectId.isValid(certificateId)) return null;

  const certificate = await Certificate.findById(certificateId);
  if (!certificate) return null;
  if (certificate.status === "issued") return certificate;

  certificate.status = "issued";
  certificate.revokedAt = null;
  certificate.revokedBy = null;
  certificate.revokedReason = "";
  await certificate.save();
  return certificate;
}
