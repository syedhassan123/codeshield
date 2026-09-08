import { PageHeader } from "@/components/ui/page-header";

export default function InterviewerEvaluationsPage() {
  return (
    <div>
      <PageHeader
        title="Evaluations"
        description="Completed interview assessments."
      />
      <div className="card-soft p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No interview evaluations available yet.
        </p>
      </div>
    </div>
  );
}
