import { redirect } from "next/navigation";
import { AdminAttemptDetailClient } from "@/components/admin/admin-attempt-detail-client";
import { getAdminAttemptDetailAction } from "@/lib/actions/grading";
import { requirePageRole } from "@/lib/safe-auth";

export default async function AdminAttemptDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  await requirePageRole(["admin"]);
  const data = await getAdminAttemptDetailAction(attemptId);

  if ("error" in data && data.error) {
    redirect("/admin/results");
  }

  if (!("attempt" in data) || !data.attempt) {
    redirect("/admin/results");
  }

  return (
    <AdminAttemptDetailClient
      attempt={data.attempt}
      student={data.student}
      assessment={data.assessment}
      result={data.result}
      timeTaken={data.timeTaken}
      security={"security" in data ? data.security : null}
      recording={"recording" in data ? data.recording : null}
      proctoringAnalysis={
        "proctoringAnalysis" in data ? data.proctoringAnalysis : null
      }
    />
  );
}
