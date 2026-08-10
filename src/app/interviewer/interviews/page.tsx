import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { mockInterviews } from "@/lib/mock-data";

export default function InterviewerInterviewsPage() {
  return (
    <div>
      <PageHeader
        title="My Interviews"
        description="All assigned interview sessions."
      />
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
            {mockInterviews.map((i) => (
              <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4 font-medium">{i.candidate}</td>
                <td className="py-3 px-4">{i.role}</td>
                <td className="py-3 px-4">{i.date}</td>
                <td className="py-3 px-4">{i.type}</td>
                <td className="py-3 px-4">{i.status}</td>
                <td className="py-3 px-4 text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/interviewer/lobby/${i.id}`}>Open</Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
