import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { mockInterviews } from "@/lib/mock-data";

export default function StudentInterviewsPage() {
  return (
    <div>
      <PageHeader
        title="My Interviews"
        description="Upcoming and past interview sessions."
      />
      <div className="space-y-3">
        {mockInterviews.map((i) => (
          <div
            key={i.id}
            className="card-soft p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
          >
            <div>
              <div className="text-xs font-semibold text-primary">{i.type}</div>
              <h3 className="font-display font-bold text-lg">{i.role}</h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                with {i.interviewer}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {i.date} · {i.duration} m
              </p>
            </div>
            {i.status === "Completed" ? (
              <span className="text-xs font-semibold">Completed</span>
            ) : (
              <Button asChild size="sm">
                <Link href={`/interviewer/lobby/${i.id}`}>Join</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
