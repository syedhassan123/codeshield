import { redirect } from "next/navigation";
import { AdminAttemptDetailClient } from "@/components/admin/admin-attempt-detail-client";
import { getAdminAttemptDetailAction } from "@/lib/actions/grading";
import { createServerOp } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";

export default async function AdminAttemptDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "PAGE_DETAIL",
    source: "SERVER-COMPONENT",
  });

  const session = await requirePageRole(["admin"]);
  op.auth(session.user);
  const { attemptId } = await params;
  const data = await getAdminAttemptDetailAction(attemptId);

  if ("error" in data && data.error) {
    op.fail(data.error);
    redirect("/admin/results");
  }

  if (!("attempt" in data) || !data.attempt) {
    redirect("/admin/results");
  }

  op.success({ attemptId });
  return (
    <AdminAttemptDetailClient
      attempt={data.attempt}
      student={data.student}
      assessment={data.assessment}
      result={data.result}
      timeTaken={data.timeTaken}
    />
  );
}
