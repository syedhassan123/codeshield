"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Play, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { twoSumProblem } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

const languages = ["Python", "JavaScript", "Java", "C++"] as const;

export function CodeEditorClient({ id }: { id: string }) {
  const problem = twoSumProblem;
  const [lang, setLang] = useState<(typeof languages)[number]>("Python");
  const [running, setRunning] = useState(false);
  const [consoleText, setConsoleText] = useState("> Click Run to execute your code");
  const [results, setResults] = useState<
    Array<{ pass: boolean; input: string; expected: string }>
  >([]);

  const codeKey = useMemo(() => {
    const map = {
      Python: "python",
      JavaScript: "javascript",
      Java: "java",
      "C++": "cpp",
    } as const;
    return map[lang];
  }, [lang]);

  const [source, setSource] = useState(problem.starter.python);

  const onLang = (l: (typeof languages)[number]) => {
    setLang(l);
    const map = {
      Python: problem.starter.python,
      JavaScript: problem.starter.javascript,
      Java: problem.starter.java,
      "C++": problem.starter.cpp,
    };
    setSource(map[l]);
  };

  const run = () => {
    setRunning(true);
    setConsoleText("");
    setTimeout(() => {
      const mocked = problem.examples.map((ex) => ({
        pass: Math.random() > 0.2,
        input: ex.input,
        expected: ex.output,
      }));
      setResults(mocked);
      setConsoleText(
        `> Running ${lang} solution…\n> ${mocked.filter((r) => r.pass).length}/${mocked.length} passed`,
      );
      setRunning(false);
    }, 900);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="h-14 border-b border-border px-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/student/coding"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">
              {problem.title} <span className="text-muted-foreground">({id})</span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              Coding Assessment · Paste disabled · Proctored
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={run} disabled={running}>
            <Play className="w-3.5 h-3.5" /> {running ? "Running…" : "Run"}
          </Button>
          <Button size="sm" onClick={run}>
            <Send className="w-3.5 h-3.5" /> Submit
          </Button>
        </div>
      </header>

      <div className="flex-1 grid lg:grid-cols-[420px_1fr] min-h-0">
        <aside className="border-r border-border p-5 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-success-soft text-success">
              Easy
            </span>
            <span className="text-xs text-muted-foreground">
              Acceptance {problem.acceptance}%
            </span>
          </div>
          <h1 className="font-display font-bold text-xl">{problem.title}</h1>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
            {problem.statement}
          </p>
          <h3 className="font-semibold mt-6 mb-2">Examples</h3>
          <div className="space-y-3">
            {problem.examples.map((ex) => (
              <div key={ex.input} className="card-soft p-3 text-xs font-mono">
                <div>
                  <span className="text-muted-foreground">Input:</span> {ex.input}
                </div>
                <div className="mt-1">
                  <span className="text-muted-foreground">Output:</span> {ex.output}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex flex-col min-h-0">
          <div className="border-b border-border px-3 py-2 flex items-center gap-2">
            {languages.map((l) => (
              <button
                key={l}
                onClick={() => onLang(l)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold",
                  lang === l
                    ? "bg-primary-soft text-primary"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {l}
              </button>
            ))}
            <span className="ml-auto text-[11px] text-muted-foreground">
              UTF-8 · {codeKey}
            </span>
          </div>
          <textarea
            value={source}
            onChange={(e) => setSource(e.target.value)}
            onPaste={(e) => e.preventDefault()}
            className="flex-1 min-h-[280px] p-4 font-mono text-sm bg-slate-950 text-slate-100 outline-none resize-none"
            spellCheck={false}
          />
          <div className="border-t border-border bg-slate-950 text-slate-200 p-4 max-h-56 overflow-y-auto">
            <div className="text-xs text-slate-400 mb-2">Console</div>
            <pre className="text-xs whitespace-pre-wrap">{consoleText}</pre>
            {results.length > 0 && (
              <div className="mt-4 space-y-2">
                <div
                  className={cn(
                    "text-xs font-semibold",
                    results.every((r) => r.pass) ? "text-success" : "text-danger",
                  )}
                >
                  {results.filter((r) => r.pass).length}/{results.length} test
                  cases passed
                </div>
                {results.map((r, i) => (
                  <div
                    key={i}
                    className={cn(
                      "p-2 rounded border text-xs",
                      r.pass
                        ? "border-success/30 bg-success/5"
                        : "border-danger/30 bg-danger/5",
                    )}
                  >
                    Test {i + 1} {r.pass ? "Passed" : "Failed"}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
