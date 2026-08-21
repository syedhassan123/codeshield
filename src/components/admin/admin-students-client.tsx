"use client";

import { useEffect, useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { listAdminStudentsAction } from "@/lib/actions/admin";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initials } from "@/lib/utils";

type StudentRow = {
  id: string;
  name: string;
  email: string;
  course: string;
  assessments: number;
  avgScore: number | null;
  violations: number;
  status: string;
};

export function AdminStudentsClient() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = (nextPage = page) => {
    setError("");
    startTransition(async () => {
      const result = await listAdminStudentsAction({
        search,
        status,
        page: nextPage,
        pageSize: 20,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        setLoaded(true);
        return;
      }
      if ("students" in result) {
        setRows(result.students);
        setPage(result.page);
        setPageCount(result.pageCount);
        setTotal(result.total);
      }
      setLoaded(true);
    });
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHeader
        title="Students"
        description={`${total} student${total === 1 ? "" : "s"} enrolled`}
        actions={
          <Button size="sm">
            <UserPlus className="w-4 h-4" /> Invite Student
          </Button>
        }
      />

      <div className="card-soft p-4 mb-4 grid md:grid-cols-3 gap-3">
        <Input
          placeholder="Search name, email, or course…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
        <Button size="sm" onClick={() => load(1)} disabled={pending}>
          {pending ? "Loading…" : "Apply filters"}
        </Button>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">Student</th>
              <th className="text-left py-3 px-4">Course</th>
              <th className="text-left py-3 px-4">Assessments</th>
              <th className="text-left py-3 px-4">Avg Score</th>
              <th className="text-left py-3 px-4">Violations</th>
              <th className="text-left py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => (
              <tr
                key={student.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full gradient-primary text-white text-xs font-bold flex items-center justify-center">
                      {initials(student.name)}
                    </div>
                    <div>
                      <div className="font-medium">{student.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {student.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="py-3 px-4">{student.course}</td>
                <td className="py-3 px-4">{student.assessments}</td>
                <td className="py-3 px-4">
                  {student.avgScore == null ? "—" : `${student.avgScore} %`}
                </td>
                <td className="py-3 px-4">
                  {student.violations === 0 ? "Clean" : student.violations}
                </td>
                <td className="py-3 px-4 capitalize">{student.status}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  {loaded ? "No students match your filters." : "Loading students…"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

      {error && <p className="text-sm font-medium text-danger mt-4">{error}</p>}
    </div>
  );
}
