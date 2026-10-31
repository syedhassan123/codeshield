"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { AdminProctoringReview } from "@/components/admin/admin-proctoring-review";
import {
  listAdminAttemptFilterOptionsAction,
  listAdminAttemptsAction,
} from "@/lib/actions/grading";
import { displayType } from "@/lib/serializers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type AttemptRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  assessmentId: string;
  assessmentTitle: string;
  assessmentType: string;
  status: string;
  evaluationStatus: string;
  objectiveScore: number | null;
  objectiveMaxMarks: number | null;
  finalScore: number | null;
  totalMarks: number;
  startedAt: string;
  submittedAt: string | null;
  proctoring?: {
    riskScore: number;
    riskLevel: string;
    recommendation: string;
    rawEventCount: number;
    derivedIncidentCount: number;
    topCategory: string | null;
  };
};

type FilterOption = { id: string; title?: string; name?: string; email?: string };

export function AdminResultsClient() {
  const [rows, setRows] = useState<AttemptRow[]>([]);
  const [assessments, setAssessments] = useState<FilterOption[]>([]);
  const [students, setStudents] = useState<FilterOption[]>([]);
  const [assessmentId, setAssessmentId] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [status, setStatus] = useState("all");
  const [evaluationStatus, setEvaluationStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [applied, setApplied] = useState({
    assessmentId: "all",
    studentId: "all",
    status: "all",
    search: "",
  });

  const load = (nextPage = page) => {
    const nextApplied = { assessmentId, studentId, status, search };
    setApplied((prev) =>
      prev.assessmentId === nextApplied.assessmentId &&
      prev.studentId === nextApplied.studentId &&
      prev.status === nextApplied.status &&
      prev.search === nextApplied.search
        ? prev
        : nextApplied,
    );
    setError("");
    startTransition(async () => {
      const result = await listAdminAttemptsAction({
        assessmentId,
        studentId,
        status,
        evaluationStatus,
        search,
        page: nextPage,
        pageSize: 20,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        setLoaded(true);
        return;
      }
      if ("attempts" in result) {
        setRows(result.attempts);
        setPage(result.page);
        setPageCount(result.pageCount);
        setTotal(result.total);
      }
      setLoaded(true);
    });
  };


  useEffect(() => {
    startTransition(async () => {
      const opts = await listAdminAttemptFilterOptionsAction();
      if ("assessments" in opts) {
        setAssessments(opts.assessments);
        setStudents(opts.students);
      }
      load(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Results & Attempts"
        description="Grade attempts and prioritize proctoring review. Window totals are not limited to the grading page."
      />

      <div className="card-soft p-4 mb-4 grid md:grid-cols-2 xl:grid-cols-5 gap-3">
        <Input
          placeholder="Search student or assessment…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={assessmentId}
          onChange={(e) => setAssessmentId(e.target.value)}
        >
          <option value="all">All assessments</option>
          {assessments.map((a) => (
            <option key={a.id} value={a.id}>
              {a.title}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="all">All students</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="in_progress">In progress</option>
          <option value="submitted">Submitted</option>
          <option value="expired">Expired</option>
        </select>
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={evaluationStatus}
          onChange={(e) => setEvaluationStatus(e.target.value)}
        >
          <option value="all">All evaluations</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="none">Not submitted</option>
        </select>
        <div className="md:col-span-2 xl:col-span-5 flex gap-2">
          <Button
            size="sm"
            onClick={() => {
              setPage(1);
              load(1);
            }}
            disabled={pending}
          >
            {pending ? "Loading…" : "Apply filters"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAssessmentId("all");
              setStudentId("all");
              setStatus("all");
              setEvaluationStatus("all");
              setSearch("");
              setPage(1);
              setApplied({
                assessmentId: "all",
                studentId: "all",
                status: "all",
                search: "",
              });
              startTransition(async () => {
                const result = await listAdminAttemptsAction({
                  page: 1,
                  pageSize: 20,
                });
                if ("attempts" in result) {
                  setRows(result.attempts);
                  setPage(result.page);
                  setPageCount(result.pageCount);
                  setTotal(result.total);
                }
              });
            }}
          >
            Reset
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
          {error}
        </div>
      )}

      <AdminProctoringReview
        assessmentId={applied.assessmentId}
        studentId={applied.studentId}
        status={applied.status}
        search={applied.search}
      />

      <h2 className="font-display font-bold text-base mb-1">Grading list</h2>
      <p className="text-sm text-muted-foreground mb-3">
        Newest attempts first. Risk on a row is that attempt only. Platform order and totals are in the review queue above.
      </p>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">Student</th>
              <th className="text-left py-3 px-4">Assessment</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-left py-3 px-4">Evaluation</th>
              <th className="text-left py-3 px-4">Objective</th>
              <th className="text-left py-3 px-4">Final</th>
              <th className="text-left py-3 px-4">Risk</th>
              <th className="text-left py-3 px-4">Incidents</th>
              <th className="text-left py-3 px-4">Submitted</th>
              <th className="text-left py-3 px-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="py-3 px-4">
                  <div className="font-medium">{r.studentName}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {r.studentEmail}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-medium">{r.assessmentTitle}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {displayType(r.assessmentType)}
                  </div>
                </td>
                <td className="py-3 px-4 capitalize">
                  {r.status.replace("_", " ")}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={cn(
                      "text-xs font-semibold capitalize",
                      r.evaluationStatus === "completed" && "text-success",
                      r.evaluationStatus === "pending" && "text-primary",
                      r.evaluationStatus === "none" && "text-muted-foreground",
                    )}
                  >
                    {r.evaluationStatus}
                  </span>
                </td>
                <td className="py-3 px-4">
                  {r.objectiveScore == null
                    ? "—"
                    : `${r.objectiveScore}/${r.objectiveMaxMarks}`}
                </td>
                <td className="py-3 px-4">
                  {r.finalScore == null
                    ? "—"
                    : `${r.finalScore}/${r.totalMarks}`}
                </td>
                <td className="py-3 px-4">
                  {r.proctoring ? (
                    <span>
                      <span className="font-semibold">
                        {r.proctoring.riskScore}
                      </span>
                      <span
                        className={cn(
                          "ml-2 text-[11px] font-semibold uppercase",
                          r.proctoring.riskLevel === "HIGH" ||
                            r.proctoring.riskLevel === "CRITICAL"
                            ? "text-danger"
                            : r.proctoring.riskLevel === "MEDIUM"
                              ? "text-amber-700"
                              : "text-success",
                        )}
                      >
                        {r.proctoring.riskLevel}
                      </span>
                      <div className="text-[11px] text-muted-foreground">
                        {r.proctoring.recommendation}
                      </div>
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-3 px-4 text-[12px]">
                  {r.proctoring
                    ? r.proctoring.rawEventCount === 0
                      ? "None recorded"
                      : `${r.proctoring.derivedIncidentCount} incident${r.proctoring.derivedIncidentCount === 1 ? "" : "s"}`
                    : "—"}
                  {r.proctoring?.topCategory ? (
                    <div className="text-[11px] text-muted-foreground">
                      {r.proctoring.topCategory}
                    </div>
                  ) : null}
                </td>
                <td className="py-3 px-4 text-[12px] text-muted-foreground">
                  {r.submittedAt
                    ? new Date(r.submittedAt).toLocaleString()
                    : "—"}
                </td>
                <td className="py-3 px-4">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/results/${r.id}`}>View</Link>
                  </Button>
                </td>
              </tr>
            ))}
            {loaded && !rows.length && !pending && (
              <tr>
                <td
                  colSpan={10}
                  className="py-10 px-4 text-center text-muted-foreground"
                >
                  No attempts match these filters.
                </td>
              </tr>
            )}
            {!loaded && (
              <tr>
                <td
                  colSpan={10}
                  className="py-10 px-4 text-center text-muted-foreground"
                >
                  Loading attempts…
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {total} attempt{total === 1 ? "" : "s"} · Page {page} of {pageCount}
        </span>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={page <= 1 || pending}
            onClick={() => {
              const next = page - 1;
              setPage(next);
              load(next);
            }}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pageCount || pending}
            onClick={() => {
              const next = page + 1;
              setPage(next);
              load(next);
            }}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
