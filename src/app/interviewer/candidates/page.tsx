import { PageHeader } from "@/components/ui/page-header";
import { mockStudents } from "@/lib/mock-data";
import { initials } from "@/lib/utils";

export default function InterviewerCandidatesPage() {
  return (
    <div>
      <PageHeader title="Assigned Candidates" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {mockStudents.map((s) => (
          <div key={s.email} className="card-soft p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
              {initials(s.name)}
            </div>
            <div>
              <div className="font-semibold text-sm">{s.name}</div>
              <div className="text-[11px] text-muted-foreground">{s.course}</div>
              <div className="text-xs font-semibold mt-1">{s.avgScore} %</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
