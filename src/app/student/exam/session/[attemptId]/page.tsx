import { redirect } from "next/navigation";
import { ExamSessionClient } from "@/components/exam/exam-session-client";
import { loadExamSessionAction } from "@/lib/actions/exam";
import { requirePageRole } from "@/lib/safe-auth";

export default async function ExamSessionPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requirePageRole(["student"]);
  const { attemptId } = await params;
  const data = await loadExamSessionAction(attemptId);

  if ("error" in data && data.error) {
    redirect("/student/assessments");
  }

  if ("closed" in data && data.closed) {
    redirect(`/student/exam/result/${attemptId}`);
  }

  if (!("questions" in data) || !data.questions || !data.attempt) {
    redirect("/student/assessments");
  }

  return (
    <ExamSessionClient
      attempt={data.attempt}
      questions={data.questions}
      answers={data.answers}
      serverNow={data.serverNow}
      security={"security" in data ? data.security : undefined}
    />
  );
}
