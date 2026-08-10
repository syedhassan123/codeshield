"use client";

import { useMemo, useState, useTransition } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import {
  createQuestionAction,
  deleteQuestionAction,
  updateQuestionAction,
} from "@/lib/actions/questions";
import {
  displayDifficulty,
  displayType,
  type SerializedQuestion,
} from "@/lib/serializers";
import {
  CODING_LANGUAGES,
  DIFFICULTIES,
  QUESTION_CATEGORIES,
  QUESTION_TYPES,
  type Difficulty,
  type QuestionCategory,
  type QuestionType,
} from "@/types/assessment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";

type Mode = "create" | "edit" | "view";

type QuestionFormState = {
  prompt: string;
  type: QuestionType;
  category: QuestionCategory;
  difficulty: Difficulty;
  points: number;
  explanation: string;
  options: Array<{ key: string; text: string }>;
  correctOptionKey: string;
  codingLanguages: string[];
  starterCode: Record<string, string>;
  testCases: Array<{ input: string; expectedOutput: string; isHidden: boolean }>;
};

const emptyForm: QuestionFormState = {
  prompt: "",
  type: "mcq",
  category: "Programming",
  difficulty: "medium",
  points: 5,
  explanation: "",
  options: [
    { key: "A", text: "" },
    { key: "B", text: "" },
    { key: "C", text: "" },
    { key: "D", text: "" },
  ],
  correctOptionKey: "A",
  codingLanguages: ["python"],
  starterCode: { python: "# write your solution" },
  testCases: [{ input: "", expectedOutput: "", isHidden: false }],
};

export function QuestionBankClient({
  initialQuestions,
}: {
  initialQuestions: SerializedQuestion[];
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<"all" | QuestionCategory>("all");
  const [type, setType] = useState<"all" | (typeof QUESTION_TYPES)[number]>("all");
  const [difficulty, setDifficulty] = useState<"all" | (typeof DIFFICULTIES)[number]>("all");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of QUESTION_CATEGORIES) counts[c] = 0;
    for (const q of questions) counts[q.category] = (counts[q.category] ?? 0) + 1;
    return counts;
  }, [questions]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (category !== "all" && q.category !== category) return false;
      if (type !== "all" && q.type !== type) return false;
      if (difficulty !== "all" && q.difficulty !== difficulty) return false;
      if (search.trim()) {
        const s = search.toLowerCase();
        return (
          q.prompt.toLowerCase().includes(s) ||
          q.code.toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [questions, category, type, difficulty, search]);

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm(emptyForm);
    setError("");
    setOpen(true);
  };

  const openEdit = (q: SerializedQuestion, viewOnly = false) => {
    setMode(viewOnly ? "view" : "edit");
    setEditingId(q.id);
    setForm({
      prompt: q.prompt,
      type: q.type as QuestionType,
      category: q.category as QuestionCategory,
      difficulty: q.difficulty as Difficulty,
      points: q.points,
      explanation: q.explanation,
      options: q.options.length ? q.options : emptyForm.options,
      correctOptionKey: q.correctOptionKey || "A",
      codingLanguages: q.codingLanguages.length
        ? [...q.codingLanguages]
        : ["python"],
      starterCode: q.starterCode?.python
        ? q.starterCode
        : { python: "# write your solution" },
      testCases: q.testCases.length
        ? q.testCases
        : [{ input: "", expectedOutput: "", isHidden: false }],
    });
    setError("");
    setOpen(true);
  };

  const save = () => {
    setError("");
    startTransition(async () => {
      const payload = {
        prompt: form.prompt,
        type: form.type,
        category: form.category,
        difficulty: form.difficulty,
        points: form.points,
        explanation: form.explanation,
        options: form.type === "mcq" ? form.options : [],
        correctOptionKey: form.type === "mcq" ? form.correctOptionKey : "",
        codingLanguages:
          form.type === "coding"
            ? (form.codingLanguages as (
                | "python"
                | "javascript"
                | "java"
                | "cpp"
              )[])
            : [],
        starterCode: form.type === "coding" ? form.starterCode : {},
        testCases: form.type === "coding" ? form.testCases : [],
      };
      const result =
        mode === "edit" && editingId
          ? await updateQuestionAction(editingId, payload)
          : await createQuestionAction(payload);

      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("question" in result && result.question) {
        setQuestions((prev) => {
          const exists = prev.some((q) => q.id === result.question!.id);
          if (exists) {
            return prev.map((q) =>
              q.id === result.question!.id ? result.question! : q,
            );
          }
          return [result.question!, ...prev];
        });
        console.log(result)
        setOpen(false);
      }
    });
  };

  const remove = (id: string) => {
    if (!confirm("Delete this question?")) return;
    startTransition(async () => {
      const result = await deleteQuestionAction(id);
      if ("error" in result && result.error) {
        alert(result.error);
        return;
      }
      setQuestions((prev) => prev.filter((q) => q.id !== id));
    });
  };

  const readOnly = mode === "view";

  return (
    <div>
      <PageHeader
        title="Question Bank"
        description="Organize and reuse questions across assessments."
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="w-4 h-4" /> Add Question
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {QUESTION_CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCategory((prev) => (prev === c ? "all" : c))}
            className={cn(
              "card-soft p-4 text-center transition",
              category === c && "ring-2 ring-primary",
            )}
          >
            <div className="font-display font-bold text-xl">
              {categoryCounts[c] ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">{c}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 mb-5">
        <Input
          placeholder="Search questions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:max-w-sm"
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm"
        >
          <option value="all">All types</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {displayType(t)}
            </option>
          ))}
        </select>
        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
          className="h-11 rounded-xl border border-border bg-card px-3 text-sm"
        >
          <option value="all">All difficulty</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {displayDifficulty(d)}
            </option>
          ))}
        </select>
      </div>

      <div className="card-soft overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border">
              <th className="text-left py-3 px-4">ID</th>
              <th className="text-left py-3 px-4">Question</th>
              <th className="text-left py-3 px-4">Category</th>
              <th className="text-left py-3 px-4">Type</th>
              <th className="text-left py-3 px-4">Difficulty</th>
              <th className="text-left py-3 px-4">Marks</th>
              <th className="text-right py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => (
              <tr
                key={q.id}
                className="border-b border-border last:border-0 hover:bg-muted/30"
              >
                <td className="py-3 px-4 font-medium">{q.code}</td>
                <td className="py-3 px-4 max-w-md truncate">{q.prompt}</td>
                <td className="py-3 px-4">{q.category}</td>
                <td className="py-3 px-4">{displayType(q.type)}</td>
                <td className="py-3 px-4">{displayDifficulty(q.difficulty)}</td>
                <td className="py-3 px-4">{q.points}</td>
                <td className="py-3 px-4">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
                      onClick={() => openEdit(q, true)}
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center"
                      onClick={() => openEdit(q)}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      className="w-8 h-8 rounded-lg hover:bg-danger-soft text-danger flex items-center justify-center"
                      onClick={() => remove(q.id)}
                      disabled={pending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">
                  No questions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={
          mode === "create"
            ? "Add Question"
            : mode === "edit"
              ? "Edit Question"
              : "Question Details"
        }
        description="MCQ, Subjective, or Coding question for the bank."
        className="max-w-3xl"
      >
        <div className="space-y-4">
          <div>
            <Label>Question text</Label>
            <textarea
              disabled={readOnly}
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
              className="w-full min-h-24 rounded-xl border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Label>Type</Label>
              <select
                disabled={readOnly}
                value={form.type}
                onChange={(e) =>
                  setForm({ ...form, type: e.target.value as typeof form.type })
                }
                className="w-full h-11 rounded-xl border border-border bg-card px-3 text-sm"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {displayType(t)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Category</Label>
              <select
                disabled={readOnly}
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
                disabled={readOnly}
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
              <Label>Points</Label>
              <Input
                disabled={readOnly}
                type="number"
                min={1}
                value={form.points}
                onChange={(e) =>
                  setForm({ ...form, points: Number(e.target.value) })
                }
              />
            </div>
          </div>

          {form.type === "mcq" && (
            <div className="space-y-3">
              <Label>Options</Label>
              {form.options.map((opt, idx) => (
                <div key={opt.key} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct"
                    disabled={readOnly}
                    checked={form.correctOptionKey === opt.key}
                    onChange={() =>
                      setForm({ ...form, correctOptionKey: opt.key })
                    }
                  />
                  <span className="text-xs font-bold w-5">{opt.key}</span>
                  <Input
                    disabled={readOnly}
                    value={opt.text}
                    onChange={(e) => {
                      const options = [...form.options];
                      options[idx] = { ...opt, text: e.target.value };
                      setForm({ ...form, options });
                    }}
                    placeholder={`Option ${opt.key}`}
                  />
                </div>
              ))}
            </div>
          )}

          {form.type === "coding" && (
            <div className="space-y-3">
              <div>
                <Label>Languages</Label>
                <div className="flex flex-wrap gap-2">
                  {CODING_LANGUAGES.map((lang) => {
                    const on = form.codingLanguages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        disabled={readOnly}
                        onClick={() => {
                          const codingLanguages = on
                            ? form.codingLanguages.filter((l) => l !== lang)
                            : [...form.codingLanguages, lang];
                          setForm({ ...form, codingLanguages });
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold border",
                          on
                            ? "gradient-primary text-white border-transparent"
                            : "bg-card border-border",
                        )}
                      >
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label>Starter code (python)</Label>
                <textarea
                  disabled={readOnly}
                  value={form.starterCode.python ?? ""}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      starterCode: { ...form.starterCode, python: e.target.value },
                    })
                  }
                  className="w-full min-h-24 rounded-xl border border-border bg-slate-950 text-slate-100 font-mono px-3 py-2 text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>Test cases</Label>
                {form.testCases.map((tc, idx) => (
                  <div key={idx} className="grid sm:grid-cols-2 gap-2">
                    <Input
                      disabled={readOnly}
                      placeholder="Input"
                      value={tc.input}
                      onChange={(e) => {
                        const testCases = [...form.testCases];
                        testCases[idx] = { ...tc, input: e.target.value };
                        setForm({ ...form, testCases });
                      }}
                    />
                    <Input
                      disabled={readOnly}
                      placeholder="Expected output"
                      value={tc.expectedOutput}
                      onChange={(e) => {
                        const testCases = [...form.testCases];
                        testCases[idx] = {
                          ...tc,
                          expectedOutput: e.target.value,
                        };
                        setForm({ ...form, testCases });
                      }}
                    />
                  </div>
                ))}
                {!readOnly && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setForm({
                        ...form,
                        testCases: [
                          ...form.testCases,
                          { input: "", expectedOutput: "", isHidden: false },
                        ],
                      })
                    }
                  >
                    Add test case
                  </Button>
                )}
              </div>
            </div>
          )}

          <div>
            <Label>Explanation</Label>
            <textarea
              disabled={readOnly}
              value={form.explanation}
              onChange={(e) =>
                setForm({ ...form, explanation: e.target.value })
              }
              className="w-full min-h-20 rounded-xl border border-border bg-card px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="text-xs font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {!readOnly && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save question"}
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
