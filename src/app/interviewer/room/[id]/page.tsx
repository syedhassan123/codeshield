"use client";

import { useState } from "react";
import Link from "next/link";
import { PhoneOff } from "lucide-react";
import { interviewQuestions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function InterviewRoomPage() {
  const [tab, setTab] = useState<"questions" | "code" | "notes">("questions");
  const [qIndex, setQIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState(`// Candidate's coding workspace\n`);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-14 border-b border-slate-800 px-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">Software Engineer Interview</div>
          <div className="text-[11px] text-slate-400">Noah Johnson · Coding</div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> REC
          </span>
          <span className="text-success font-semibold">Verified</span>
          <span>0 alerts</span>
          <span className="font-mono">00:00</span>
        </div>
        <Link
          href="/interviewer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-semibold"
        >
          <PhoneOff className="w-4 h-4" /> End
        </Link>
      </header>

      <div className="flex-1 grid lg:grid-cols-[1.1fr_1fr] min-h-0">
        <section className="p-4 grid grid-rows-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 relative overflow-hidden">
            <div className="absolute top-3 left-3 text-[11px] font-bold bg-black/50 px-2 py-1 rounded">
              FACE 96%
            </div>
            <div className="h-full flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center font-bold text-xl">
                NJ
              </div>
            </div>
            <div className="absolute bottom-3 left-3 text-xs font-semibold">
              Noah Johnson
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 relative overflow-hidden">
            <div className="h-full flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xl">
                KM
              </div>
            </div>
            <div className="absolute bottom-3 left-3 text-xs font-semibold">You</div>
          </div>
        </section>

        <section className="border-l border-slate-800 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-semibold text-sm mb-3">AI Monitoring</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                ["Face Detection", "Active"],
                ["Eye Contact", "82%"],
                ["Head Movement", "Normal"],
                ["Multiple Persons", "None"],
                ["Emotion", "Engaged"],
                ["Voice Activity", "Clear"],
                ["Network", "Stable"],
                ["Alerts", "0"],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-900 border border-slate-800 p-2">
                  <div className="text-slate-400">{l}</div>
                  <div className="font-semibold mt-0.5">{v}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex border-b border-slate-800">
            {(["questions", "code", "notes"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 py-2.5 text-xs font-semibold capitalize",
                  tab === t
                    ? "text-white border-b-2 border-primary"
                    : "text-slate-400",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {tab === "questions" && (
              <div className="p-5">
                <div className="text-xs text-slate-400 mb-2">
                  Question {qIndex + 1} of {interviewQuestions.length}
                </div>
                <h2 className="font-display font-bold text-lg">
                  {interviewQuestions[qIndex]}
                </h2>
                <div className="mt-5 space-y-2">
                  {interviewQuestions.map((q, i) => (
                    <button
                      key={q}
                      onClick={() => setQIndex(i)}
                      className={cn(
                        "w-full text-left text-xs p-2 rounded-lg border",
                        i === qIndex
                          ? "border-primary bg-primary/10"
                          : "border-slate-800 hover:bg-slate-900",
                      )}
                    >
                      {i + 1}. {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {tab === "code" && (
              <div className="flex flex-col h-full">
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 min-h-[280px] p-4 font-mono text-sm bg-slate-950 outline-none resize-none"
                />
                <div className="p-3 border-t border-slate-800">
                  <button className="px-3 py-1.5 rounded-lg gradient-primary text-white text-xs font-semibold">
                    Run
                  </button>
                </div>
              </div>
            )}
            {tab === "notes" && (
              <div className="p-4 h-full">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Type your interview notes here…"
                  className="w-full h-full min-h-[280px] bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none"
                />
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
