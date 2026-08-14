"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import {
  setAssessmentQuestionsAction,
  setAssessmentStatusAction,
  updateAssessmentAction,
} from "@/lib/actions/assessments";
import {
  displayDifficulty,
  displayStatus,
  displayType,
  type SerializedAssessment,
  type SerializedQuestion,
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

export function AssessmentDetailClient({
  initialAssessment,
  initialQuestions,
  bank,
}: {
  initialAssessment: SerializedAssessment;
  initialQuestions: SerializedQuestion[];
  bank: SerializedQuestion[];
}) {
  const [assessment, setAssessment] = useState(initialAssessment);
  const [questions, setQuestions] = useState(initialQuestions);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(
    initialAssessment.questionIds,
  );
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: initialAssessment.title,
    description: initialAssessment.description,
    instructions: initialAssessment.instructions,
    type: initialAssessment.type,
    category: initialAssessment.category,
    difficulty: initialAssessment.difficulty,
    durationMin: initialAssessment.durationMin,
    visibility: initialAssessment.visibility,
    security: initialAssessment.security ?? {
      requireCamera: false,
      requireFullscreen: true,
      blockCopyPaste: true,
      monitorTabSwitching: true,
      requireFaceDetection: false,
      requireHeadMonitoring: false,
    },
  });

  const available = useMemo(
    () => bank.filter((q) => !questions.some((aq) => aq.id === q.id)),
    [bank, questions],
  );

  const saveMeta = () => {
    setError("");
    startTransition(async () => {
      const result = await updateAssessmentAction(assessment.id, {
        ...form,
        questionIds: questions.map((q) => q.id),
        assignedStudentIds: assessment.assignedStudentIds,
        scheduledAt: assessment.scheduledAt,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("assessment" in result && result.assessment) {
        setAssessment(result.assessment);
      }
    });
  };

  const saveQuestions = (ids: string[]) => {
    startTransition(async () => {
      const result = await setAssessmentQuestionsAction(assessment.id, {
        questionIds: ids,
      });
      if ("error" in result && result.error) {
        alert(result.error);
        return;
      }
      if ("assessment" in result && result.assessment) {
        setAssessment(result.assessment);
        const next = bank.filter((q) => ids.includes(q.id));
        // keep order of ids
        setQuestions(
          ids
            .map((id) => next.find((q) => q.id === id) || questions.find((q) => q.id === id))
            .filter(Boolean) as SerializedQuestion[],
        );
        setPickerOpen(false);
      }
    });
  };

  const removeQuestion = (id: string) => {
    const ids = questions.filter((q) => q.id !== id).map((q) => q.id);
    saveQuestions(ids);
  };

  const togglePublish = () => {
    const status = assessment.status === "published" ? "draft" : "published";
    startTransition(async () => {
      const result = await setAssessmentStatusAction(assessment.id, { status });
      if ("error" in result && result.error) {
        alert(result.error);
        return;
      }
      if ("assessment" in result && result.assessment) {
        setAssessment(result.assessment);
      }
    });
  };

  return (
    <div>
      <Link
        href="/admin/assessments"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back to assessments
      </Link>

      <PageHeader
        title={assessment.title}
        description={`${assessment.code} · ${displayStatus(assessment.status)}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={togglePublish} disabled={pending}>
              {assessment.status === "published" ? "Unpublish" : "Publish"}
            </Button>
            <Button size="sm" onClick={saveMeta} disabled={pending}>
              Save changes
            </Button>
          </>
        }
      />

      <div className="grid lg:grid-cols-3 gap-5 mb-6">
        <div className="card-soft p-5 lg:col-span-2 space-y-4">
          <div>
            <Label>Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
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
              className="w-full min-h-24 rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as typeof form.type })
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

          <div className="rounded-xl border border-border p-4 space-y-3">
            <h4 className="text-sm font-semibold">Exam security settings</h4>
            {(
              [
                ["requireCamera", "Require camera / recording"],
                ["requireFaceDetection", "Require face monitoring"],
                ["requireHeadMonitoring", "Require head movement monitoring"],
                ["requireFullscreen", "Require fullscreen"],
                ["blockCopyPaste", "Block copy / paste / cut"],
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
        </div>

        <div className="card-soft p-5 space-y-3">
          <h3 className="font-display font-bold">Summary</h3>
          <div className="text-sm flex justify-between border-b border-border py-2">
            <span className="text-muted-foreground">Questions</span>
            <span className="font-semibold">{questions.length}</span>
          </div>
          <div className="text-sm flex justify-between border-b border-border py-2">
            <span className="text-muted-foreground">Total marks</span>
            <span className="font-semibold">{assessment.totalMarks}</span>
          </div>
          <div className="text-sm flex justify-between border-b border-border py-2">
            <span className="text-muted-foreground">Visibility</span>
            <span className="font-semibold capitalize">{form.visibility}</span>
          </div>
          <div className="text-sm flex justify-between py-2">
            <span className="text-muted-foreground">Status</span>
            <span className="font-semibold">
              {displayStatus(assessment.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="card-soft p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-bold">Attached questions</h3>
          <Button
            size="sm"
            onClick={() => {
              setSelected(questions.map((q) => q.id));
              setPickerOpen(true);
            }}
          >
            <Plus className="w-4 h-4" /> Add / manage
          </Button>
        </div>
        <div className="space-y-2">
          {questions.map((q) => (
            <div
              key={q.id}
              className="flex items-center gap-3 p-3 rounded-xl border border-border"
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-primary">{q.code}</div>
                <div className="text-sm font-medium truncate">{q.prompt}</div>
                <div className="text-[11px] text-muted-foreground">
                  {displayType(q.type)} · {q.category} · {q.points} pts
                </div>
              </div>
              <button
                type="button"
                className="w-8 h-8 rounded-lg hover:bg-danger-soft text-danger flex items-center justify-center"
                onClick={() => removeQuestion(q.id)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {!questions.length && (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No questions attached yet.
            </p>
          )}
        </div>
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Manage questions"
        description="Select questions from the bank to attach."
        className="max-w-3xl"
      >
        <div className="space-y-2 max-h-[50vh] overflow-y-auto mb-4">
          {[...questions, ...available].map((q) => {
            const on = selected.includes(q.id);
            return (
              <button
                key={q.id}
                type="button"
                onClick={() =>
                  setSelected((prev) =>
                    on ? prev.filter((id) => id !== q.id) : [...prev, q.id],
                  )
                }
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition",
                  on
                    ? "border-primary bg-primary-soft"
                    : "border-border hover:bg-muted/40",
                )}
              >
                <div className="text-xs font-semibold text-primary">{q.code}</div>
                <div className="text-sm font-medium">{q.prompt}</div>
              </button>
            );
          })}
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setPickerOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={pending}
            onClick={() => saveQuestions(selected)}
          >
            Save selection
          </Button>
        </div>
      </Modal>
    </div>
  );
}
