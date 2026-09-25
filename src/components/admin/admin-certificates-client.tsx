"use client";

import { useEffect, useState, useTransition } from "react";
import { Award, ExternalLink } from "lucide-react";
import Link from "next/link";
import {
  listAdminCertificatesAction,
  reinstateCertificateAction,
  revokeCertificateAction,
} from "@/lib/actions/certificates-admin";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { StatusBadge } from "@/components/ui/status-badge";

type CertificateRow = {
  id: string;
  studentName: string;
  studentEmail: string;
  assessmentTitle: string;
  score: number;
  passThreshold: number;
  certificateSerial: string;
  issuedAt: string;
  status: "issued" | "revoked";
  revokedAt: string | null;
  revokedReason: string;
};

export function AdminCertificatesClient() {
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();

  const [revokeTarget, setRevokeTarget] = useState<CertificateRow | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [actionError, setActionError] = useState("");
  const [acting, startActing] = useTransition();

  const load = (nextPage = page) => {
    setError("");
    startTransition(async () => {
      const result = await listAdminCertificatesAction({
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
      if ("certificates" in result) {
        setRows(result.certificates);
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

  const openRevoke = (row: CertificateRow) => {
    setActionError("");
    setRevokeReason("");
    setRevokeTarget(row);
  };

  const confirmRevoke = () => {
    if (!revokeTarget) return;
    setActionError("");
    startActing(async () => {
      const result = await revokeCertificateAction({
        certificateId: revokeTarget.id,
        reason: revokeReason,
      });
      if ("error" in result && result.error) {
        setActionError(result.error);
        return;
      }
      setRevokeTarget(null);
      load(page);
    });
  };

  const reinstate = (row: CertificateRow) => {
    setError("");
    startActing(async () => {
      const result = await reinstateCertificateAction({
        certificateId: row.id,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      load(page);
    });
  };

  return (
    <div>
      <PageHeader
        title="Certificates"
        description={`${total} certificate${total === 1 ? "" : "s"} issued`}
      />

      <div className="card-soft p-4 mb-4 grid md:grid-cols-3 gap-3">
        <Input
          placeholder="Search student, email, assessment, or serial…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="issued">Issued</option>
          <option value="revoked">Revoked</option>
        </select>
        <Button size="sm" onClick={() => load(1)} disabled={pending}>
          {pending ? "Loading…" : "Apply filters"}
        </Button>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.id}
            className="card-soft p-4 flex flex-col sm:flex-row sm:items-center gap-4 justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{row.studentName}</span>
                  <StatusBadge variant={row.status === "issued" ? "success" : "danger"}>
                    {row.status}
                  </StatusBadge>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {row.studentEmail} · {row.assessmentTitle} · Score{" "}
                  {row.score.toFixed(0)}% (pass {row.passThreshold}%)
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  {row.certificateSerial} · Issued{" "}
                  {new Date(row.issuedAt).toLocaleDateString()}
                  {row.status === "revoked" && row.revokedReason
                    ? ` · Revoked: ${row.revokedReason}`
                    : ""}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/verify/${encodeURIComponent(row.certificateSerial)}`}
                  target="_blank"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Public view
                </Link>
              </Button>
              {row.status === "issued" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openRevoke(row)}
                  disabled={acting}
                >
                  Revoke
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => reinstate(row)}
                  disabled={acting}
                >
                  Reinstate
                </Button>
              )}
            </div>
          </div>
        ))}

        {!rows.length && (
          <div className="card-soft p-8 text-center text-sm text-muted-foreground">
            {loaded ? "No certificates match the selected filters." : "Loading certificates…"}
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

      {error && <p className="text-sm font-medium text-danger mt-4">{error}</p>}

      <Modal
        open={!!revokeTarget}
        onClose={() => (acting ? undefined : setRevokeTarget(null))}
        title="Revoke certificate"
        description={
          revokeTarget
            ? `${revokeTarget.studentName} · ${revokeTarget.assessmentTitle}`
            : undefined
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="revoke-reason">Reason (visible to admins only)</Label>
            <textarea
              id="revoke-reason"
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              rows={3}
              className="flex w-full rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none transition placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Issued in error, academic integrity finding overturned…"
            />
          </div>
          {actionError && (
            <p className="text-sm font-medium text-danger">{actionError}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRevokeTarget(null)}
              disabled={acting}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={confirmRevoke} disabled={acting}>
              {acting ? "Revoking…" : "Confirm revoke"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
