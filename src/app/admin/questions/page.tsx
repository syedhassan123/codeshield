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
  await connectDB();
  const docs = await op.runMongo("fetching questions for admin page", () =>
    Question.find().sort({ createdAt: -1 }),
  );
  const questions = docs.map(serializeQuestion);
  op.success({ count: questions.length });
  return <QuestionBankClient initialQuestions={questions} />;
}
