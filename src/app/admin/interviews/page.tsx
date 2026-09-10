import { connectDB } from "@/lib/db";
import {
  listAdminInterviewerPanel,
  listAdminInterviews,
  listAssignableInterviewers,
  listAssignableStudents,
} from "@/lib/admin/interviews";
import { requirePageRole } from "@/lib/safe-auth";
import { AdminInterviewsClient } from "@/components/admin/admin-interviews-client";

export default async function AdminInterviewsPage() {
  await requirePageRole(["admin"]);
  await connectDB();

  const [interviews, students, interviewers, panel] = await Promise.all([
    listAdminInterviews(),
    listAssignableStudents(),
    listAssignableInterviewers(),
    listAdminInterviewerPanel(),
  ]);

  return (
    <AdminInterviewsClient
      initialInterviews={interviews}
      students={students}
      interviewers={interviewers}
      panel={panel}
    />
  );
}
