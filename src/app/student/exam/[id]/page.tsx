import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { ExamGateClient } from "@/components/exam/exam-gate-client";
import { connectDB } from "@/lib/db";
import { createServerOp, maskId } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import { serializeAssessment } from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { Attempt } from "@/models/Attempt";

export default async function ExamGatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const op = createServerOp({
    domain: "EXAM",
    operation: "GATE",
    source: "SERVER-COMPONENT",
    resourceId: id,
  });

  const session = await requirePageRole(["student"]);
  op.auth(session.user);
  await connectDB();
  const studentId = new mongoose.Types.ObjectId(session.user.id);

  const identity = mongoose.Types.ObjectId.isValid(id)
    ? { $or: [{ _id: id }, { code: id }] }
    : { code: id };

  const doc = await op.runMongo("student assessment access lookup", () =>
    Assessment.findOne({
      $and: [
        identity,
        { status: "published" },
        {
          $or: [
            { visibility: "all" },
            { visibility: "assigned", assignedStudentIds: studentId },
          ],
        },
      ],
    }),
  );

  if (!doc) {
    op.fail("not_found_or_not_visible", { resourceId: maskId(id) });
    notFound();
  }

  const active = await op.runMongo("find active attempt", () =>
    Attempt.findOne({
      studentId,
      assessmentId: doc._id,
      status: "in_progress",
    }),
  );

  const latestClosed = await op.runMongo("find latest closed attempt", () =>
    Attempt.findOne({
      studentId,
      assessmentId: doc._id,
      status: { $in: ["submitted", "expired"] },
    }).sort({ submittedAt: -1 }),
  );

  const payload = op.respond({
    assessment: serializeAssessment(doc, {
      questionCount: doc.questionIds?.length ?? 0,
    }),
    activeAttemptId: active?._id.toString() ?? null,
    latestResultAttemptId: latestClosed?._id.toString() ?? null,
  });

  return (
    <ExamGateClient
      assessment={payload.assessment}
      activeAttemptId={payload.activeAttemptId}
      latestResultAttemptId={payload.latestResultAttemptId}
    />
  );
}
