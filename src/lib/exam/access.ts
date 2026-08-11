import mongoose from "mongoose";
import { ActionError } from "@/lib/auth-guards";
import type { AssessmentDocument } from "@/models/Assessment";
import { Assessment } from "@/models/Assessment";

export async function findPublishedAssessmentForStudent(
  idOrCode: string,
  studentId: string,
): Promise<AssessmentDocument> {
  const studentOid = new mongoose.Types.ObjectId(studentId);
  const identity = mongoose.Types.ObjectId.isValid(idOrCode)
    ? { $or: [{ _id: idOrCode }, { code: idOrCode }] }
    : { code: idOrCode };

  const doc = await Assessment.findOne({
    $and: [
      identity,
      { status: "published" },
      {
        $or: [
          { visibility: "all" },
          { visibility: "assigned", assignedStudentIds: studentOid },
        ],
      },
    ],
  });

  if (!doc) {
    throw new ActionError("Assessment not available.");
  }

  return doc;
}
