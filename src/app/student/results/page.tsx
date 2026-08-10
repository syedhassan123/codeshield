import { PageHeader } from "@/components/ui/page-header";
import { mockResults } from "@/lib/mock-data";

export default function StudentResultsPage() {
  return (
    <div>
      <PageHeader
        title="Results"
        description="Detailed breakdown of your past assessments."
      />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">Assessment</th>
              <th className="text-left py-3 px-4">Score</th>
              <th className="text-left py-3 px-4">Result</th>
              <th className="text-left py-3 px-4">Time</th>
              <th className="text-left py-3 px-4">Date</th>
            </tr>
          </thead>
          <tbody>
            {mockResults.map((r) => (
              <tr key={r.assessment} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4 font-medium">{r.assessment}</td>
                <td className="py-3 px-4">{r.score} %</td>
                <td className="py-3 px-4">
                  <span
                    className={
                      r.result === "Passed"
                        ? "text-success font-semibold"
                        : "text-danger font-semibold"
                    }
                  >
                    {r.result}
                  </span>
                </td>
                <td className="py-3 px-4">{r.time}</td>
                <td className="py-3 px-4">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
