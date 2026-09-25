import mongoose from "mongoose";
import { isValidObjectId } from "@/lib/interviewer/queries";
import { serializeCertificate } from "@/lib/serializers";
import { Certificate } from "@/models/Certificate";

/** All certificates issued to a student, most recent first. */
export async function listCertificatesForStudent(studentId: string) {
  const docs = await Certificate.find({
    studentId: new mongoose.Types.ObjectId(studentId),
    status: "issued",
  }).sort({ issuedAt: -1 });

  return docs.map(serializeCertificate);
}

/**
 * Ownership-gated single certificate lookup — returns null (not a thrown
 * error) on both "not found" and "not owned" so callers can render an
 * identical 404 either way (no existence leak). Used by the printable
 * detail route, which must NOT rely on the list page being the only entry
 * point: direct navigation to another student's certificate URL must be
 * rejected here independently.
 */
export async function getOwnedCertificate(
  certificateId: string,
  studentId: string,
) {
  if (!isValidObjectId(certificateId)) return null;

  const doc = await Certificate.findOne({
    _id: certificateId,
    studentId: new mongoose.Types.ObjectId(studentId),
    status: "issued",
  });

  if (!doc) return null;
  return serializeCertificate(doc);
}
