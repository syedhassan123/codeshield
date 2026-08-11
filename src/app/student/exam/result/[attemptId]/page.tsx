import { redirect } from "next/navigation";
import { ExamResultClient } from "@/components/exam/exam-result-client";
import { getExamResultAction } from "@/lib/actions/exam";
import { requirePageRole } from "@/lib/safe-auth";

export default async function ExamResultPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  await requirePageRole(["student"]);
  const { attemptId } = await params;
  const data = await getExamResultAction(attemptId);

  if ("error" in data && data.error) {
    if (data.error.includes("still in progress")) {
      redirect(`/student/exam/session/${attemptId}`);
    }
    redirect("/student/results");
  }

  if (!("result" in data) || !data.result || !data.attempt) {
    redirect("/student/results");
  }

  return <ExamResultClient attempt={data.attempt} result={data.result} />;
}
