import { notFound } from "next/navigation";
import mongoose from "mongoose";
import { ExamGateClient } from "@/components/exam/exam-gate-client";
import { connectDB } from "@/lib/db";
import { createServerOp, maskId } from "@/lib/debug";
import { findPublishedAssessmentForStudent } from "@/lib/exam/access";
import { ensureAttemptNotExpired } from "@/lib/exam/finalize";
import { requirePageRole } from "@/lib/safe-auth";
import { serializeAssessment } from "@/lib/serializers";
import { Attempt } from "@/models/Attempt";
import { ActionError } from "@/lib/auth-guards";

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

  let doc;
  try {
    doc = await op.runMongo("student assessment access lookup", () =>
      findPublishedAssessmentForStudent(id, session.user.id),
    );
  } catch (error) {
    op.fail("not_found_or_not_visible", { resourceId: maskId(id) });
    if (error instanceof ActionError) {
      notFound();
    }
    throw error;
  }

  const activeDoc = await op.runMongo("find active attempt", () =>
    Attempt.findOne({
      studentId,
      assessmentId: doc._id,
      status: "in_progress",
    }),
  );

  let activeAttemptId: string | null = null;
  if (activeDoc) {
    const live = await ensureAttemptNotExpired(activeDoc);
    if (live.status === "in_progress") {
      activeAttemptId = live._id.toString();
    }
  }

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
    activeAttemptId,
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
