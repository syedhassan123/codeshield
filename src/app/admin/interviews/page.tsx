import { CalendarPlus, Star } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { mockInterviews, mockPanel } from "@/lib/mock-data";
import { initials } from "@/lib/utils";

export default function AdminInterviewsPage() {
  return (
    <div>
      <PageHeader
        title="Interviews"
        description="Schedule and assign interviews to your panel."
        actions={
          <Button size="sm">
            <CalendarPlus className="w-4 h-4" /> Schedule Interview
          </Button>
        }
      />

      <div className="card-soft p-5 mb-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold">Scheduled Interviews</h3>
          <span className="text-sm font-semibold">{mockInterviews.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-2">Candidate</th>
              <th className="text-left py-3 px-2">Role</th>
              <th className="text-left py-3 px-2">Interviewer</th>
              <th className="text-left py-3 px-2">Date</th>
              <th className="text-left py-3 px-2">Type</th>
              <th className="text-left py-3 px-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {mockInterviews.map((i) => (
              <tr key={i.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-2 font-medium">{i.candidate}</td>
                <td className="py-3 px-2">{i.role}</td>
                <td className="py-3 px-2">{i.interviewer}</td>
                <td className="py-3 px-2">{i.date}</td>
                <td className="py-3 px-2">{i.type}</td>
                <td className="py-3 px-2">{i.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="font-display font-bold mb-4">Interview Panel</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockPanel.map((p) => (
          <div key={p.name} className="card-soft p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
              {initials(p.name)}
            </div>
            <div>
              <div className="font-semibold text-sm">{p.name}</div>
              <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                {p.specialty} · <Star className="w-3 h-3 text-warning fill-warning" /> {p.rating}
              </div>
              <div className="text-[11px] text-muted-foreground">{p.count} interviews</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
