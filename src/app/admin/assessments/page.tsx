import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import { serializeAssessment } from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { AssessmentsManagerClient } from "@/components/admin/assessments-manager-client";

export default async function AdminAssessmentsPage() {
  const op = createServerOp({
    domain: "ASSESSMENT",
    operation: "PAGE_LIST",
    source: "SERVER-COMPONENT",
  });

  const session = await requirePageRole(["admin"]);
  op.auth(session.user);
  op.allowed({ action: "list_assessments", role: session.user.role });
  await connectDB();
  const docs = await op.runMongo("fetching assessments for admin page", () =>
    Assessment.find().sort({ updatedAt: -1 }),
  );
  const assessments = op.respond({
    assessments: docs.map((doc) =>
      serializeAssessment(doc, {
        questionCount: doc.questionIds?.length ?? 0,
      }),
    ),
  }).assessments;

  return <AssessmentsManagerClient initialAssessments={assessments} />;
}
