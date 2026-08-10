import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { mockCodingProblems } from "@/lib/mock-data";

export default function StudentCodingPage() {
  return (
    <div>
      <PageHeader
        title="Coding Tests"
        description="Sharpen your skills with curated coding challenges."
      />
      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">Problem</th>
              <th className="text-left py-3 px-4">Difficulty</th>
              <th className="text-left py-3 px-4">Acceptance</th>
              <th className="text-left py-3 px-4">Solved by</th>
              <th className="text-left py-3 px-4" />
            </tr>
          </thead>
          <tbody>
            {mockCodingProblems.map((p) => (
              <tr key={p.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                <td className="py-3 px-4 font-medium">{p.title}</td>
                <td className="py-3 px-4">{p.difficulty}</td>
                <td className="py-3 px-4">{p.acceptance} %</td>
                <td className="py-3 px-4">{p.solvedBy.toLocaleString()}</td>
                <td className="py-3 px-4 text-right">
                  <Button asChild size="sm">
                    <Link href={`/student/code/${p.id}`}>Solve</Link>
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
