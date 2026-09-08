import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import { listInterviewerInterviews } from "@/lib/interviewer/queries";
import { requirePageRole } from "@/lib/safe-auth";

export default async function InterviewerInterviewsPage() {
  const session = await requirePageRole(["interviewer"]);

  let interviews: Awaited<ReturnType<typeof listInterviewerInterviews>> = [];
  let loadError = false;

  try {
    await connectDB();
    interviews = await listInterviewerInterviews(session.user.id);
  } catch {
    loadError = true;
  }

  return (
    <div>
      <PageHeader
        title="My Interviews"
        description="All assigned interview sessions."
      />

      {loadError && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Unable to load interviews. Please try again.
        </div>
      )}

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">Candidate</th>
              <th className="text-left py-3 px-4">Role</th>
              <th className="text-left py-3 px-4">Date</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {interviews.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 px-4 text-center text-muted-foreground"
                >
                  No interviews assigned yet.
                </td>
              </tr>
            ) : (
              interviews.map((interview) => (
                <tr
                  key={interview.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="py-3 px-4 font-medium">
                    {interview.candidateName}
                  </td>
                  <td className="py-3 px-4">{interview.title}</td>
                  <td className="py-3 px-4">
                    {interview.formattedDate} · {interview.formattedTime}
                  </td>
                  <td className="py-3 px-4">{interview.type}</td>
                  <td className="py-3 px-4">{interview.displayStatus}</td>
                  <td className="py-3 px-4 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/interviewer/lobby/${interview.id}`}>
                        Open
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
