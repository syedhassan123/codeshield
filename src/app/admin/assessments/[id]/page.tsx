import { notFound } from "next/navigation";
import { connectDB } from "@/lib/db";
import { createServerOp, maskId } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import {
  serializeAssessment,
  serializeQuestion,
} from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { Question } from "@/models/Question";
import { AssessmentDetailClient } from "@/components/admin/assessment-detail-client";

export default async function AdminAssessmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "PAGE_DETAIL",
    source: "SERVER-COMPONENT",
    resourceId: id,
  });

  const session = await requirePageRole(["admin"]);
  op.auth(session.user);
  await connectDB();

  const doc = await op.runMongo("fetch assessment by id", () =>
    Assessment.findById(id),
  );
  if (!doc) {
    op.fail("not_found", { resourceId: maskId(id) });
    notFound();
  }

  const attached = await op.runMongo("fetch attached questions", () =>
    Question.find({ _id: { $in: doc.questionIds } }),
  );
  const ordered = (doc.questionIds ?? [])
    .map((qid) => attached.find((q) => q._id.equals(qid)))
    .filter(Boolean)
    .map((q) => serializeQuestion(q!));

  const marks = ordered.reduce((sum, q) => sum + q.points, 0);
  const bankDocs = await op.runMongo("fetch question bank", () =>
    Question.find().sort({ createdAt: -1 }),
  );

  const payload = op.respond({
    assessment: serializeAssessment(doc, {
      questionCount: ordered.length,
      computedMarks: marks,
    }),
    questions: ordered,
    bank: bankDocs.map(serializeQuestion),
  });

  return (
    <AssessmentDetailClient
      initialAssessment={payload.assessment}
      initialQuestions={payload.questions}
      bank={payload.bank}
    />
  );
}
