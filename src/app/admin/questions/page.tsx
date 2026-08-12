import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import { serializeQuestion } from "@/lib/serializers";
import { Question } from "@/models/Question";
import { QuestionBankClient } from "@/components/admin/question-bank-client";

export default async function AdminQuestionsPage() {
  const op = createServerOp({
    domain: "QUESTION",
    operation: "PAGE_LIST",
    source: "SERVER-COMPONENT",
  });

  const session = await requirePageRole(["admin"]);
  op.auth(session.user);
  op.allowed({ action: "list_questions", role: session.user.role });
  await connectDB();
  const docs = await op.runMongo("fetching questions for admin page", () =>
    Question.find().sort({ createdAt: -1 }),
  );
  const questions = op.respond({
    questions: docs.map(serializeQuestion),
  }).questions;

  return <QuestionBankClient initialQuestions={questions} />;
}
