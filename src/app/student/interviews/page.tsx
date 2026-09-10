import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import {
  listStudentInterviews,
  partitionStudentInterviews,
} from "@/lib/student/interview-queries";
import { requirePageRole } from "@/lib/safe-auth";

function InterviewCard({
  interview,
}: {
  interview: Awaited<ReturnType<typeof listStudentInterviews>>[number];
}) {
  return (
    <div className="card-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <div className="text-xs font-semibold text-primary">{interview.type}</div>
        <h3 className="font-display font-bold text-lg">{interview.title}</h3>
        <p className="text-[11px] text-muted-foreground mt-1">
          with {interview.interviewerName}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {interview.formattedDate} · {interview.formattedTime} ·{" "}
          {interview.durationMin} m · {interview.displayStatus}
        </p>
      </div>
      {interview.isJoinable ? (
        <Button asChild size="sm">
          <Link href={`/interviewer/lobby/${interview.id}`}>Join</Link>
        </Button>
      ) : (
        <span className="text-xs font-semibold">{interview.displayStatus}</span>
      )}
    </div>
  );
}

export default async function StudentInterviewsPage() {
  const session = await requirePageRole(["student"]);

  let interviews: Awaited<ReturnType<typeof listStudentInterviews>> = [];
  let loadError = false;

  try {
    await connectDB();
    interviews = await listStudentInterviews(session.user.id);
  } catch {
    loadError = true;
  }

  const { upcoming, past } = partitionStudentInterviews(interviews);

  return (
    <div>
      <PageHeader
        title="My Interviews"
        description="Upcoming and past interview sessions."
      />

      {loadError && (
        <div className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          Unable to load interviews. Please try again.
        </div>
      )}

      {interviews.length === 0 ? (
        <div className="card-soft p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No interviews scheduled yet.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display font-bold text-sm">Upcoming</h3>
              {upcoming.map((interview) => (
                <InterviewCard key={interview.id} interview={interview} />
              ))}
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-3">
              <h3 className="font-display font-bold text-sm">Past</h3>
              {past.map((interview) => (
                <InterviewCard key={interview.id} interview={interview} />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
