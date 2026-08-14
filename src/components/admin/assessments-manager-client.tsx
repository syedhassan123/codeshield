"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createAssessmentAction,
  deleteAssessmentAction,
  setAssessmentStatusAction,
} from "@/lib/actions/assessments";
import {
  displayDifficulty,
  displayStatus,
  displayType,
  type SerializedAssessment,
} from "@/lib/serializers";
import {
  ASSESSMENT_TYPES,
  DIFFICULTIES,
  QUESTION_CATEGORIES,
} from "@/types/assessment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

const emptyForm = {
  title: "",
  description: "",
  instructions:
    "You will be monitored by AI proctoring. Tab switching and copy/paste may be disabled.",
  type: "mixed" as const,
  category: "Programming" as const,
  difficulty: "medium" as const,
  durationMin: 60,
  visibility: "all" as const,
  scheduledAt: "",
  security: {
    requireCamera: false,
    requireFullscreen: true,
    blockCopyPaste: true,
    monitorTabSwitching: true,
    requireFaceDetection: false,
    requireHeadMonitoring: false,
  },
};

export function AssessmentsManagerClient({
  initialAssessments,
}: {
  initialAssessments: SerializedAssessment[];
}) {
  const [assessments, setAssessments] = useState(initialAssessments);
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    if (typeFilter === "all") return assessments;
    return assessments.filter((a) => a.type === typeFilter);
  }, [assessments, typeFilter]);

  const create = () => {
    setError("");
    startTransition(async () => {
      const result = await createAssessmentAction({
        ...form,
        scheduledAt: form.scheduledAt || null,
        questionIds: [],
        totalMarks: 0,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("assessment" in result && result.assessment) {
        setAssessments((prev) => [result.assessment!, ...prev]);
        setOpen(false);
        setForm(emptyForm);
      }
    });
  };

  const togglePublish = (a: SerializedAssessment) => {
    const next = a.status === "published" ? "draft" : "published";
    startTransition(async () => {
      const result = await setAssessmentStatusAction(a.id, { status: next });
      if ("error" in result && result.error) {
        alert(result.error);
        return;
      }
      if ("assessment" in result && result.assessment) {
        setAssessments((prev) =>
          prev.map((item) =>
            item.id === a.id ? result.assessment! : item,
          ),
        );
      }
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this assessment?")) return;
    startTransition(async () => {
      const result = await deleteAssessmentAction(id);
      if ("error" in result && result.error) {
        alert(result.error);
        return;
      }
      setAssessments((prev) => prev.filter((a) => a.id !== id));
    });
  };

  return (
    <div>
      <PageHeader
        title="Assessments"
        description="Create, schedule and manage all assessment types."
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="w-4 h-4" /> New Assessment
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {["all", ...ASSESSMENT_TYPES].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTypeFilter(f)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-semibold capitalize",
              typeFilter === f
                ? "gradient-primary text-white"
                : "bg-card border border-border text-muted-foreground",
            )}
          >
            {f === "all" ? "All" : displayType(f)}
          </button>
        ))}
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">Assessment</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Category</th>
              <th className="text-left py-3 px-4">Questions</th>
              <th className="text-left py-3 px-4">Duration</th>
              <th className="text-left py-3 px-4">Marks</th>
              <th className="text-left py-3 px-4">Difficulty</th>
              <th className="text-left py-3 px-4">Status</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr
                key={a.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="py-3 px-4">
                  <div className="font-medium">{a.title}</div>
                  <div className="text-[11px] text-muted-foreground">{a.code}</div>
                </td>
                <td className="py-3 px-4">{displayType(a.type)}</td>
                <td className="py-3 px-4">{a.category}</td>
                <td className="py-3 px-4">{a.questionCount}</td>
                <td className="py-3 px-4">{a.durationMin} m</td>
                <td className="py-3 px-4">{a.totalMarks}</td>
                <td className="py-3 px-4">{displayDifficulty(a.difficulty)}</td>
                <td className="py-3 px-4">{displayStatus(a.status)}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-end items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePublish(a)}
                      disabled={pending}
                    >
                      {a.status === "published" ? "Unpublish" : "Publish"}
                    </Button>
                    <Link
                      href={`/admin/assessments/${a.id}`}
                      className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg hover:bg-danger-soft text-danger flex items-center justify-center"
                      onClick={() => remove(a.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={9} className="py-10 text-center text-muted-foreground">
                  No assessments yet. Create one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Assessment"
        description="Create a draft assessment, then attach questions."
      >
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Foundations of Python"
            />
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full min-h-20 rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div>
            <Label>Instructions</Label>
            <textarea
              value={form.instructions}
              onChange={(e) =>
                setForm({ ...form, instructions: e.target.value })
              }
              className="w-full min-h-20 rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as typeof form.type,
                  })
                }
                className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm"
              >
                {ASSESSMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {displayType(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Category</Label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm({
                    ...form,
                    category: e.target.value as typeof form.category,
                  })
                }
                className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm"
              >
                {QUESTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <select
                value={form.difficulty}
                onChange={(e) =>
                  setForm({
                    ...form,
                    difficulty: e.target.value as typeof form.difficulty,
                  })
                }
                className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {displayDifficulty(d)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                min={1}
                value={form.durationMin}
                onChange={(e) =>
                  setForm({ ...form, durationMin: Number(e.target.value) })
                }
              />
            </div>
          </div>
          <div className="rounded-xl border border-border p-3 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Security
            </p>
            {(
              [
                ["requireCamera", "Require camera"],
                ["requireFaceDetection", "Require face monitoring"],
                ["requireHeadMonitoring", "Require head monitoring"],
                ["requireFullscreen", "Require fullscreen"],
                ["blockCopyPaste", "Block copy/paste"],
                ["monitorTabSwitching", "Monitor tab switching"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={form.security[key]}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setForm({
                      ...form,
                      security: {
                        ...form.security,
                        [key]: checked,
                        ...(key === "requireFaceDetection" && checked
                          ? { requireCamera: true }
                          : {}),
                        ...(key === "requireHeadMonitoring" && checked
                          ? {
                              requireCamera: true,
                              requireFaceDetection: true,
                            }
                          : {}),
                      },
                    });
                  }}
                />
              </label>
            ))}
          </div>
          {error && (
            <div className="text-xs font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={pending}>
              {pending ? "Creating…" : "Create assessment"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
