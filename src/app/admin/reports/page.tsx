import { FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { mockReports } from "@/lib/mock-data";

export default function AdminReportsPage() {
  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and export comprehensive reports."
      />

      <h3 className="font-display font-bold mb-4">Generated Reports</h3>
      <div className="space-y-3">
        {mockReports.map((r) => (
          <div
            key={r.title}
            className="card-soft p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-primary">{r.type}</div>
                <div className="font-semibold">{r.title}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.date} · {r.size}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">PDF</Button>
              <Button variant="outline" size="sm">Excel</Button>
              <Button variant="outline" size="sm">CSV</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
