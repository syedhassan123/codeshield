"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { Play, Save, Send } from "lucide-react";
import {
  getCodingSubmissionSummaryAction,
  runCodingVisibleAction,
  submitCodingAction,
} from "@/lib/actions/coding";
import { saveAnswerAction } from "@/lib/actions/exam";
import type { SerializedExamQuestion } from "@/lib/serializers";
import type { CodingLanguage } from "@/types/assessment";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VisibleResult = {
  index: number;
  passed: boolean;
  status: string;
  timeMs: number;
  message: string;
  stdout?: string;
  expectedOutput?: string;
  input?: string;
};

type Props = {
  attemptId: string;
  question: SerializedExamQuestion;
  initialLanguage: string;
  initialSourceCode: string;
  /** Updates parent answer map without driving a controlled editor value. */
  onDraftChange: (patch: {
    selectedOptionKey: string;
    textAnswer: string;
  }) => void;
  disabled?: boolean;
};

const AUTOSAVE_MS = 1500;

function starterFor(
  question: SerializedExamQuestion,
  lang: CodingLanguage,
) {
  return question.starterCode?.[lang] ?? "";
}

export function ExamCodingPanel({
  attemptId,
  question,
  initialLanguage,
  initialSourceCode,
  onDraftChange,
  disabled,
}: Props) {
  const languages = useMemo(
    () =>
      (question.codingLanguages.length
        ? question.codingLanguages
        : ["python"]) as CodingLanguage[],
    [question.codingLanguages],
  );

  const bootstrapLang = (
    languages.includes(initialLanguage as CodingLanguage)
      ? initialLanguage
      : languages[0]
  ) as CodingLanguage;

  const [activeLang, setActiveLang] = useState<CodingLanguage>(bootstrapLang);
  const [codeByLang, setCodeByLang] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const lang of languages) {
      seed[lang] = starterFor(question, lang);
    }
    if (initialSourceCode) {
      seed[bootstrapLang] = initialSourceCode;
    } else if (!seed[bootstrapLang]) {
      seed[bootstrapLang] = starterFor(question, bootstrapLang);
    }
    return seed;
  });
  const sourceCode = codeByLang[activeLang] ?? "";

  const [busy, startTransition] = useTransition();
  const [saveBusy, setSaveBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [runResults, setRunResults] = useState<VisibleResult[]>([]);
  const [runSummary, setRunSummary] = useState("");
  const [submitSummary, setSubmitSummary] = useState<{
    passedTests: number;
    totalTests: number;
    score: number;
    maxScore: number;
    status: string;
  } | null>(null);
  const [finalized, setFinalized] = useState(false);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ lang: activeLang, code: sourceCode });
  latestRef.current = { lang: activeLang, code: sourceCode };

  // Reset local editor state only when the question changes — never on each keystroke.
  useEffect(() => {
    const lang = (
      languages.includes(initialLanguage as CodingLanguage)
        ? initialLanguage
        : languages[0]
    ) as CodingLanguage;
    const seed: Record<string, string> = {};
    for (const l of languages) {
      seed[l] = starterFor(question, l);
    }
    seed[lang] = initialSourceCode || starterFor(question, lang);
    setActiveLang(lang);
    setCodeByLang(seed);
    setDirty(false);
    setSaveState("idle");
    setRunResults([]);
    setRunSummary("");
    setError("");
    setSubmitSummary(null);
    setFinalized(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const result = await getCodingSubmissionSummaryAction(
        attemptId,
        question.id,
      );
      if (cancelled) return;
      if ("submission" in result && result.submission) {
        setFinalized(true);
        setDirty(false);
        setSubmitSummary({
          passedTests: result.submission.passedTests,
          totalTests: result.submission.totalTests,
          score: result.submission.score,
          maxScore: result.submission.maxScore,
          status: result.submission.status,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [attemptId, question.id]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  const persistDraft = async (lang: CodingLanguage, code: string) => {
    setSaveBusy(true);
    setSaveState("saving");
    try {
      const result = await saveAnswerAction({
        attemptId,
        questionId: question.id,
        selectedOptionKey: lang,
        textAnswer: code,
      });
      if ("error" in result && result.error) {
        setSaveState("error");
        setError(result.error);
        return false;
      }
      onDraftChange({ selectedOptionKey: lang, textAnswer: code });
      setDirty(false);
      setSaveState("saved");
      setError("");
      return true;
    } catch {
      setSaveState("error");
      setError("Could not save code.");
      return false;
    } finally {
      setSaveBusy(false);
    }
  };

  const scheduleAutosave = (lang: CodingLanguage, code: string) => {
    if (finalized || disabled) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void persistDraft(lang, code);
    }, AUTOSAVE_MS);
  };

  const setLanguage = (lang: CodingLanguage) => {
    if (finalized || disabled) return;
    setActiveLang(lang);
    setCodeByLang((prev) => {
      if (prev[lang] != null && prev[lang] !== "") return prev;
      return { ...prev, [lang]: starterFor(question, lang) };
    });
    setDirty(true);
    const nextCode =
      codeByLang[lang] != null && codeByLang[lang] !== ""
        ? codeByLang[lang]
        : starterFor(question, lang);
    scheduleAutosave(lang, nextCode);
  };

  const onCodeChange = (value: string) => {
    if (finalized || disabled) return;
    setCodeByLang((prev) => ({ ...prev, [activeLang]: value }));
    setDirty(true);
    setSaveState("idle");
    scheduleAutosave(activeLang, value);
  };

  const saveNow = () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    void persistDraft(activeLang, sourceCode);
  };

  const runVisible = () => {
    setError("");
    const { lang, code } = latestRef.current;
    startTransition(async () => {
      if (dirty) {
        await persistDraft(lang, code);
      }
      const result = await runCodingVisibleAction({
        attemptId,
        questionId: question.id,
        language: lang,
        sourceCode: code,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("results" in result && result.results) {
        setRunResults(result.results);
        setRunSummary(
          `${result.passedTests}/${result.totalTests} visible tests passed · ${result.executionTimeMs}ms`,
        );
      }
    });
  };

  const submitCode = () => {
    setError("");
    const { lang, code } = latestRef.current;
    startTransition(async () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      const result = await submitCodingAction({
        attemptId,
        questionId: question.id,
        language: lang,
        sourceCode: code,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("score" in result) {
        setFinalized(true);
        setDirty(false);
        setSubmitSummary({
          passedTests: result.passedTests,
          totalTests: result.totalTests,
          score: result.score,
          maxScore: result.maxScore,
          status: result.status,
        });
        onDraftChange({ selectedOptionKey: lang, textAnswer: code });
      }
    });
  };

  const editorLocked = finalized || disabled;

  return (
    <div className="space-y-4">
      {(question.constraints ||
        question.inputFormat ||
        question.outputFormat ||
        question.examples.length > 0) && (
        <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3 text-sm">
          {question.constraints?.trim() && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Constraints
              </p>
              <p className="whitespace-pre-wrap">{question.constraints}</p>
            </div>
          )}
          {question.inputFormat?.trim() && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Input format
              </p>
              <p className="whitespace-pre-wrap">{question.inputFormat}</p>
            </div>
          )}
          {question.outputFormat?.trim() && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                Output format
              </p>
              <p className="whitespace-pre-wrap">{question.outputFormat}</p>
            </div>
          )}
          {question.examples.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Examples
              </p>
              {question.examples.map((ex, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-border bg-background p-3 font-mono text-xs space-y-1"
                >
                  <pre className="whitespace-pre-wrap m-0">
                    <span className="text-muted-foreground">Input:</span>
                    {"\n"}
                    {ex.input}
                  </pre>
                  <pre className="whitespace-pre-wrap m-0">
                    <span className="text-muted-foreground">Output:</span>
                    {"\n"}
                    {ex.output}
                  </pre>
                  {ex.explanation?.trim() && (
                    <p className="font-sans text-muted-foreground">
                      {ex.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Limits: {question.timeLimitMs}ms · {question.memoryLimitMb}MB ·{" "}
            {question.visibleTestCount} visible test
            {question.visibleTestCount === 1 ? "" : "s"}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex flex-wrap gap-2">
          {languages.map((lang) => (
            <button
              key={lang}
              type="button"
              disabled={editorLocked || busy}
              onClick={() => setLanguage(lang)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border",
                activeLang === lang
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border text-muted-foreground",
              )}
            >
              {lang}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] text-muted-foreground">
            {saveBusy || saveState === "saving"
              ? "Saving…"
              : dirty
                ? "Unsaved changes"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : "Ready"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={editorLocked || saveBusy || !dirty}
            onClick={saveNow}
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={editorLocked || busy || !sourceCode.trim()}
            onClick={runVisible}
          >
            <Play className="w-3.5 h-3.5" />
            {busy ? "Working…" : "Run"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={editorLocked || busy || !sourceCode.trim()}
            onClick={submitCode}
          >
            <Send className="w-3.5 h-3.5" />
            {finalized ? "Submitted" : "Submit code"}
          </Button>
        </div>
      </div>

      <textarea
        key={question.id}
        disabled={editorLocked}
        spellCheck={false}
        className="w-full min-h-[260px] rounded-xl border border-border bg-slate-950 text-slate-100 font-mono px-4 py-3 text-sm outline-none focus:border-primary"
        placeholder="Write your solution…"
        value={sourceCode}
        onChange={(e) => onCodeChange(e.target.value)}
      />

      {runSummary && (
        <p className="text-sm font-medium text-muted-foreground">{runSummary}</p>
      )}

      {runResults.length > 0 && (
        <div className="space-y-2">
          {runResults.map((r) => (
            <div
              key={r.index}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                r.passed
                  ? "border-success/40 bg-success-soft/40"
                  : "border-danger/40 bg-danger-soft/40",
              )}
            >
              <div className="flex justify-between gap-2 font-semibold">
                <span>
                  Test {r.index}: {r.passed ? "Passed" : "Failed"}
                </span>
                <span>{r.timeMs}ms</span>
              </div>
              {r.input != null && (
                <pre className="mt-1 font-mono text-muted-foreground whitespace-pre-wrap m-0">
                  Input:{"\n"}
                  {r.input}
                </pre>
              )}
              {r.stdout != null && (
                <pre className="font-mono whitespace-pre-wrap m-0">
                  Output:{"\n"}
                  {r.stdout || "(empty)"}
                </pre>
              )}
              {!r.passed && r.expectedOutput != null && (
                <pre className="font-mono whitespace-pre-wrap m-0">
                  Expected:{"\n"}
                  {r.expectedOutput}
                </pre>
              )}
              {!r.passed && r.message && (
                <p className="text-danger mt-1">{r.message}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {submitSummary && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft/40 px-4 py-3 text-sm">
          <p className="font-semibold">Coding submission scored</p>
          <p className="text-muted-foreground mt-1">
            {submitSummary.passedTests}/{submitSummary.totalTests} tests passed
            · {submitSummary.score}/{submitSummary.maxScore} marks · status:{" "}
            {submitSummary.status}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Hidden test inputs are not shown. Score is calculated server-side.
          </p>
        </div>
      )}

      {error && <p className="text-sm font-medium text-danger">{error}</p>}
    </div>
  );
}
