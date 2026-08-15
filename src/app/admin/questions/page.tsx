import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { requiredQuestionTypeForAssessment } from "@/lib/assessment-question-type";
import { requirePageRole } from "@/lib/safe-auth";
import { serializeQuestion } from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { Question } from "@/models/Question";
import { QuestionBankClient } from "@/components/admin/question-bank-client";

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ forAssessment?: string }>;
}) {
  const { forAssessment } = await searchParams;
  const op = createServerOp({
    domain: "QUESTION",
    operation: "PAGE_LIST",
    source: "SERVER-COMPONENT",
  });

  const session = await requirePageRole(["admin"]);
  op.auth(session.user);
  op.allowed({ action: "list_questions", role: session.user.role });
  await connectDB();

  let assessmentContext:
    | {
        assessmentId: string;
        assessmentTitle: string;
        requiredType: "mcq" | "subjective" | "coding";
      }
    | undefined;

  if (forAssessment) {
    const assessment = await Assessment.findById(forAssessment).select(
      "title type",
    );
    const requiredType = assessment
      ? requiredQuestionTypeForAssessment(assessment.type)
      : null;
    if (assessment && requiredType) {
      assessmentContext = {
        assessmentId: assessment._id.toString(),
        assessmentTitle: assessment.title,
        requiredType,
      };
    }
  }

  const docs = await op.runMongo("fetching questions for admin page", () =>
    Question.find().sort({ createdAt: -1 }),
  );
  op.success({ count: docs.length });

  return (
    <QuestionBankClient
      initialQuestions={docs.map(serializeQuestion)}
      assessmentContext={assessmentContext}
    />
  );
}
