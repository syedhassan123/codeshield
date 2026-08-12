import Link from "next/link";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import { serializeResult } from "@/lib/serializers";
import { Result } from "@/models/Result";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

export default async function StudentResultsPage() {
  const op = createServerOp({
    domain: "RESULT",
    operation: "PAGE_LIST",
    source: "SERVER-COMPONENT",
  });

  const session = await requirePageRole(["student"]);
  op.auth(session.user);
  op.allowed({ action: "list_results", role: session.user.role });
  await connectDB();

  const docs = await op.runMongo("list results for student page", () =>
    Result.find({ studentId: session.user.id }).sort({ submittedAt: -1 }),
  );
  const results = op.respond({ results: docs.map(serializeResult) }).results;

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
              <th className="text-left py-3 px-4">Objective</th>
              <th className="text-left py-3 px-4">Final</th>
              <th className="text-left py-3 px-4">Evaluation</th>
              <th className="text-left py-3 px-4">Submitted</th>
              <th className="text-left py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="py-3 px-4 font-medium">{r.assessmentTitle}</td>
                <td className="py-3 px-4">
                  {r.objectiveScore} / {r.objectiveMaxMarks}
                </td>
                <td className="py-3 px-4">
                  {r.finalScore} / {r.totalMarks}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      "text-xs font-semibold capitalize",
                      r.evaluationStatus === "completed"
                        ? "text-success"
                        : "text-primary",
                    )}
                  >
                    {r.evaluationStatus}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {new Date(r.submittedAt).toLocaleString()}
                </td>
                <td className="py-3 px-4">
                  <Link
                    href={`/student/exam/result/${r.attemptId}`}
                    className="text-primary font-semibold text-xs"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
            {!results.length && (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 px-4 text-center text-muted-foreground"
                >
                  No results yet. Complete an assessment to see scores here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
