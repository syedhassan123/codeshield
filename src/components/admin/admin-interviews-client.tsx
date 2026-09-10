"use client";

import { useMemo, useState, useTransition } from "react";
import { CalendarPlus, Pencil, XCircle } from "lucide-react";
import {
  cancelInterviewAction,
  createInterviewAction,
  updateInterviewAction,
} from "@/lib/actions/interviews-admin";
import type {
  AdminInterviewerPanelItem,
  AssignableUser,
  SerializedAdminInterview,
} from "@/lib/admin/interviews";
import { INTERVIEW_TYPES, type InterviewType } from "@/types/interview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { initials } from "@/lib/utils";

const emptyForm = {
  candidateId: "",
  interviewerId: "",
  title: "",
  type: "Coding" as InterviewType,
  scheduledAt: "",
  durationMin: 60,
  meetingUrl: "",
};

export function AdminInterviewsClient({
  initialInterviews,
  students,
  interviewers,
  panel,
}: {
  initialInterviews: SerializedAdminInterview[];
  students: AssignableUser[];
  interviewers: AssignableUser[];
  panel: AdminInterviewerPanelItem[];
}) {
  const [interviews, setInterviews] = useState(initialInterviews);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const editing = useMemo(
    () => interviews.find((item) => item.id === editId) ?? null,
    [editId, interviews],
  );

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  };

  const openEdit = (item: SerializedAdminInterview) => {
    setEditId(item.id);
    setForm({
      candidateId: item.candidateId,
      interviewerId: item.interviewerId,
      title: item.title,
      type: item.type,
      scheduledAt: item.scheduledAtInput,
      durationMin: item.durationMin,
      meetingUrl: item.meetingUrl ?? "",
    });
    setError("");
    setOpen(true);
  };

  const save = () => {
    setError("");
    startTransition(async () => {
      const payload = {
        ...form,
        meetingUrl: form.meetingUrl || null,
      };

      const result = editId
        ? await updateInterviewAction({ interviewId: editId, ...payload })
        : await createInterviewAction(payload);

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }

      if ("interview" in result && result.interview) {
        setInterviews((prev) => {
          const next = editId
            ? prev.map((item) =>
                item.id === result.interview!.id ? result.interview! : item,
              )
            : [result.interview!, ...prev];
          return next.sort((a, b) =>
            `${b.formattedDate} ${b.formattedTime}`.localeCompare(
              `${a.formattedDate} ${a.formattedTime}`,
            ),
          );
        });
        setOpen(false);
        setEditId(null);
        setForm(emptyForm);
      }
    });
  };

  const cancelInterview = (item: SerializedAdminInterview) => {
    if (!confirm(`Cancel interview for ${item.candidateName}?`)) return;
    startTransition(async () => {
      const result = await cancelInterviewAction({ interviewId: item.id });
      if ("error" in result && result.error) {
        alert(result.error);
        return;
      }
      if ("interview" in result && result.interview) {
        setInterviews((prev) =>
          prev.map((row) => (row.id === item.id ? result.interview! : row)),
        );
      }
    });
  };

  return (
    <div>
      <PageHeader
        title="Interviews"
        description="Schedule and assign interviews to your panel."
        actions={
          <Button size="sm" onClick={openCreate}>
            <CalendarPlus className="w-4 h-4" /> Schedule Interview
          </Button>
        }
      />

      <div className="card-soft p-5 mb-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold">Scheduled Interviews</h3>
          <span className="text-sm font-semibold">{interviews.length}</span>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-2">Candidate</th>
              <th className="text-left py-3 px-2">Role</th>
              <th className="text-left py-3 px-2">Interviewer</th>
              <th className="text-left py-3 px-2">Date</th>
              <th className="text-left py-3 px-2">Type</th>
              <th className="text-left py-3 px-2">Status</th>
              <th className="text-left py-3 px-2" />
            </tr>
          </thead>
          <tbody>
            {interviews.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                  No interviews scheduled yet.
                </td>
              </tr>
            ) : (
              interviews.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30"
                >
                  <td className="py-3 px-2 font-medium">{item.candidateName}</td>
                  <td className="py-3 px-2">{item.title}</td>
                  <td className="py-3 px-2">{item.interviewerName}</td>
                  <td className="py-3 px-2">
                    {item.formattedDate} · {item.formattedTime}
                  </td>
                  <td className="py-3 px-2">{item.type}</td>
                  <td className="py-3 px-2">{item.displayStatus}</td>
                  <td className="py-3 px-2 text-right whitespace-nowrap">
                    <Button
                      size="sm"
                      variant="outline"
                      className="mr-2"
                      onClick={() => openEdit(item)}
                      disabled={
                        pending ||
                        item.status === "cancelled" ||
                        item.status === "completed"
                      }
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cancelInterview(item)}
                      disabled={
                        pending ||
                        item.status === "cancelled" ||
                        item.status === "completed"
                      }
                    >
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <h3 className="font-display font-bold mb-4">Interview Panel</h3>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {panel.length === 0 ? (
          <div className="card-soft p-6 text-sm text-muted-foreground">
            No interviewers with assigned interviews yet.
          </div>
        ) : (
          panel.map((p) => (
            <div key={p.id} className="card-soft p-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center text-sm font-bold">
                {p.initials || initials(p.name)}
              </div>
              <div>
                <div className="font-semibold text-sm">{p.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  Interviewer
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p.interviewCount} interviews
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Edit Interview" : "Schedule Interview"}
        description="Assign a candidate and interviewer for this session."
      >
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="candidateId">Candidate</Label>
            <select
              id="candidateId"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              value={form.candidateId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, candidateId: e.target.value }))
              }
              disabled={pending || Boolean(editing?.hasEvaluation)}
            >
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name} · {student.course}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="interviewerId">Interviewer</Label>
            <select
              id="interviewerId"
              className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
              value={form.interviewerId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, interviewerId: e.target.value }))
              }
              disabled={pending || Boolean(editing?.hasEvaluation)}
            >
              <option value="">Select interviewer</option>
              {interviewers.map((interviewer) => (
                <option key={interviewer.id} value={interviewer.id}>
                  {interviewer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="title">Role / Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, title: e.target.value }))
              }
              disabled={pending}
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as InterviewType,
                  }))
                }
                disabled={pending || editing?.status === "completed"}
              >
                {INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="durationMin">Duration (min)</Label>
              <Input
                id="durationMin"
                type="number"
                min={1}
                max={480}
                value={form.durationMin}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    durationMin: Number(e.target.value),
                  }))
                }
                disabled={pending || editing?.status === "completed"}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="scheduledAt">Scheduled date/time</Label>
            <Input
              id="scheduledAt"
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, scheduledAt: e.target.value }))
              }
              disabled={
                pending ||
                editing?.status === "completed" ||
                editing?.status === "in_progress"
              }
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="meetingUrl">Meeting URL (optional)</Label>
            <Input
              id="meetingUrl"
              value={form.meetingUrl}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, meetingUrl: e.target.value }))
              }
              disabled={pending}
              placeholder="https://..."
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : editId ? "Save Changes" : "Schedule Interview"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
