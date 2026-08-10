import { PageHeader } from "@/components/ui/page-header";
import { mockEvaluations } from "@/lib/mock-data";
import { initials } from "@/lib/utils";

export default function InterviewerEvaluationsPage() {
  return (
    <div>
      <PageHeader
        title="Evaluations"
        description="Completed interview assessments."
      />
      <div className="space-y-3">
        {mockEvaluations.map((e) => (
          <div
            key={`${e.name}-${e.date}`}
            className="card-soft p-4 flex items-center gap-3"
          >
            <div className="w-12 h-12 rounded-full bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
              {initials(e.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold">{e.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {e.role} · {e.date}
              </div>
            </div>
            <div className="text-lg font-display font-bold">
              {e.score == null ? "- %" : `${e.score} %`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
