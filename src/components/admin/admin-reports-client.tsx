"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import {
  exportAdminReportsCsvAction,
  exportAdminReportsPdfAction,
  listAdminReportFilterOptionsAction,
  listAdminReportsAction,
} from "@/lib/actions/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ReportRow = {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  assessmentTitle: string;
  status: string;
  evaluationStatus: string;
  finalScore: number | null;
  totalMarks: number;
  violationCount: number;
  riskLevel: string;
  submittedAt: string | null;
};

type FilterOption = { id: string; title?: string; name?: string; email?: string };

function downloadText(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function openPrintableHtml(html: string) {
  const popup = window.open("", "_blank");
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  popup.print();
}

export function AdminReportsClient() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [assessments, setAssessments] = useState<FilterOption[]>([]);
  const [students, setStudents] = useState<FilterOption[]>([]);
  const [assessmentId, setAssessmentId] = useState("all");
  const [studentId, setStudentId] = useState("all");
  const [status, setStatus] = useState("all");
  const [evaluationStatus, setEvaluationStatus] = useState("all");
  const [riskLevel, setRiskLevel] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const filters = {
    assessmentId,
    studentId,
    status,
    evaluationStatus,
    riskLevel,
    dateFrom,
    dateTo,
    search,
  };

  const load = (nextPage = page) => {
    setError("");
    setExportMessage("");
    startTransition(async () => {
      const result = await listAdminReportsAction({
        ...filters,
        page: nextPage,
        pageSize: 20,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        setLoaded(true);
        return;
      }
      if ("rows" in result) {
        setRows(result.rows);
        setPage(result.page);
        setPageCount(result.pageCount);
        setTotal(result.total);
      }
      setLoaded(true);
    });
  };

  useEffect(() => {
    startTransition(async () => {
      const opts = await listAdminReportFilterOptionsAction();
      if ("assessments" in opts) {
        setAssessments(opts.assessments);
        setStudents(opts.students);
      }
      load(1);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    setExportMessage("");
    startTransition(async () => {
      const result = await exportAdminReportsCsvAction(filters);
      if ("error" in result && result.error) {
        setExportMessage(result.error);
        return;
      }
      if ("csv" in result && result.csv && result.filename) {
        downloadText(result.csv, result.filename, "text/csv;charset=utf-8");
        setExportMessage(`Exported ${result.count} record(s) to CSV.`);
      }
    });
  };

  const exportPdf = () => {
    setExportMessage("");
    startTransition(async () => {
      const result = await exportAdminReportsPdfAction(filters);
      if ("error" in result && result.error) {
        setExportMessage(result.error);
        return;
      }
      if ("html" in result && result.html) {
        openPrintableHtml(result.html);
        setExportMessage(`Opened ${result.count} record(s) for PDF export.`);
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Generate and export comprehensive reports."
      />

      <div className="card-soft p-4 mb-4 grid md:grid-cols-2 xl:grid-cols-4 gap-3">
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
          {assessments.map((assessment) => (
            <option key={assessment.id} value={assessment.id}>
              {assessment.title}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        >
          <option value="all">All students</option>
          {students.map((student) => (
            <option key={student.id} value={student.id}>
              {student.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All attempt statuses</option>
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
          <option value="none">No result yet</option>
          <option value="pending">Pending grading</option>
          <option value="completed">Completed</option>
        </select>
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
        >
          <option value="all">All risk levels</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <Button size="sm" onClick={() => load(1)} disabled={pending}>
          {pending ? "Loading…" : "Apply filters"}
        </Button>
        <Button variant="outline" size="sm" onClick={exportPdf} disabled={pending}>
          Export PDF
        </Button>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={pending}>
          Export CSV
        </Button>
      </div>

      <h3 className="font-display font-bold mb-4">
        Attempt Reports · {total} record{total === 1 ? "" : "s"}
      </h3>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.attemptId}
            className="card-soft p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="text-[11px] font-semibold text-primary capitalize">
                  {row.evaluationStatus === "completed" ? "Completed" : row.status}
                </div>
                <div className="font-semibold">
                  {row.studentName} · {row.assessmentTitle}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {row.submittedAt
                    ? new Date(row.submittedAt).toLocaleString()
                    : "In progress"}{" "}
                  · Score {row.finalScore ?? "—"}/{row.totalMarks} · Violations{" "}
                  {row.violationCount} · Risk {row.riskLevel}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/results/${row.attemptId}`}>View</Link>
              </Button>
            </div>
          </div>
        ))}

        {!rows.length && (
          <div className="card-soft p-8 text-center text-sm text-muted-foreground">
            {loaded ? "No reports match the selected filters." : "Loading reports…"}
          </div>
        )}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || pending}
              onClick={() => load(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= pageCount || pending}
              onClick={() => load(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {exportMessage && (
        <p className="text-sm text-muted-foreground mt-4">{exportMessage}</p>
      )}
      {error && <p className="text-sm font-medium text-danger mt-4">{error}</p>}
    </div>
  );
}
