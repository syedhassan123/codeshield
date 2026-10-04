// "use client";

// import { useState, useTransition } from "react";
// import Link from "next/link";
// import {
//   completeEvaluationAction,
//   gradeQuestionAction,
//   suggestSubjectiveGradeAction,
// } from "@/lib/actions/grading";
// import type { SerializedAttempt, SerializedResult } from "@/lib/serializers";
// import { displayType } from "@/lib/serializers";
// import { Button } from "@/components/ui/button";
// import { Input } from "@/components/ui/input";
// import { PageHeader } from "@/components/ui/page-header";
// import { AdminSecurityReport } from "@/components/admin/admin-security-report";
// import { AdminProctoringAnalysisReport } from "@/components/admin/admin-proctoring-analysis-report";
// import { AdminProctoringReport } from "@/components/admin/admin-proctoring-report";
// import { cn } from "@/lib/utils";
// import type { SecuritySummary } from "@/lib/exam/security";
// import type { SerializedSecurityEvent } from "@/lib/actions/exam-security";
// import type { SerializedExamRecording } from "@/lib/actions/exam-recording";
// import type { ProctoringAnalysis } from "@/lib/proctoring/analyze";
// import type { AssessmentSecuritySettings } from "@/types/assessment-security";

// export function AdminAttemptDetailClient({
//   attempt: initialAttempt,
//   student,
//   assessment,
//   result: initialResult,
//   timeTaken,
//   security,
//   recording = null,
//   proctoringAnalysis = null,
// }: {
//   attempt: SerializedAttempt;
//   student: { id: string; name: string; email: string };
//   assessment: {
//     id: string;
//     title: string;
//     type: string;
//     durationMin: number;
//     totalMarks: number;
//     security?: AssessmentSecuritySettings;
//   };
//   result: SerializedResult | null;
//   timeTaken: string | null;
//   security?: {
//     summary: SecuritySummary;
//     events: SerializedSecurityEvent[];
//   } | null;
//   recording?: SerializedExamRecording | null;
//   proctoringAnalysis?: ProctoringAnalysis | null;
// }) {
//   const [attempt] = useState(initialAttempt);
//   const [result, setResult] = useState(initialResult);
//   const [drafts, setDrafts] = useState<
//     Record<string, { marks: string; feedback: string }>
//   >(() => {
//     const map: Record<string, { marks: string; feedback: string }> = {};
//     for (const q of initialResult?.questions ?? []) {
//       if (q.type !== "mcq") {
//         map[q.questionId] = {
//           marks: String(q.awardedPoints ?? 0),
//           feedback: q.feedback ?? "",
//         };
//       }
//     }
//     return map;
//   });
//   const [error, setError] = useState("");
//   const [message, setMessage] = useState("");
//   const [pending, startTransition] = useTransition();
//   const [suggestingId, setSuggestingId] = useState<string | null>(null);

//   const saveGrade = (questionId: string) => {
//     const draft = drafts[questionId];
//     if (!draft) return;
//     setError("");
//     setMessage("");
//     startTransition(async () => {
//       const res = await gradeQuestionAction({
//         attemptId: attempt.id,
//         questionId,
//         marks: Number(draft.marks),
//         feedback: draft.feedback,
//       });
//       if ("error" in res && res.error) {
//         setError(res.error);
//         console.log(res.error)
//         return;
//       }
//       if ("result" in res && res.result) {
//         setResult(res.result);
//         setMessage("Grading saved. Score recalculated.");
//         console.log(res.result)
//       }
//     });
//   };

//   const suggestGrade = (questionId: string) => {
//     if (suggestingId) return;
//     console.log("[AI-GRADING-UI] CLICK");
//     setError("");
//     setMessage("");
//     setSuggestingId(questionId);
//     void (async () => {
//       try {
//         console.log("[AI-GRADING-UI] REQUEST_STARTED");
//         const res = await suggestSubjectiveGradeAction({
//           attempt:attempt,
//           attemptId: attempt.id,
//           questionId,
//         });
//         console.log("[AI-GRADING-UI] RESPONSE_RECEIVED");
//         if ("error" in res && res.error) {
//           console.log("[AI-GRADING-UI] ERROR");
//           console.log("[AI-GRADING] ERROR_STAGE: CLIENT");
//           setError(res.error);
//           return;
//         }
//         if ("suggestedMarks" in res) {
//           setDrafts((prev) => ({
//             ...prev,
//             [questionId]: {
//               marks: String(res.suggestedMarks),
//               feedback: res.feedback,
//             },
//           }));
//           console.log("[AI-GRADING-UI] DRAFT_UPDATED", {
//             response:res,
//             suggestedMarks: res.suggestedMarks,
//             feedbackLength: res.feedback.length,
//           });
//           setMessage(
//             "AI suggestion loaded. Review or edit it, then click Save grade. Nothing is saved yet. Student answers are sent to a third-party AI provider for this suggestion.",
//           );
//         }
//       } catch {
//         console.log("[AI-GRADING-UI] ERROR");
//         console.log("[AI-GRADING] ERROR_STAGE: CLIENT");
//         setError("AI grading is unavailable right now.");
//       } finally {
//         setSuggestingId(null);
//       }
//     })();
//   };

//   const complete = () => {
//     setError("");
//     setMessage("");
//     startTransition(async () => {
//       const res = await completeEvaluationAction(attempt.id);
//       if ("error" in res && res.error) {
//         setError(res.error);
//         return;
//       }
//       if ("result" in res && res.result) {
//         setResult(res.result);
//         setMessage("Evaluation marked completed.");
//       }
//     });
//   };

//   return (
//     <div>
//       <PageHeader
//         title="Attempt details"
//         description={assessment.title}
//         actions={
//           <Button asChild variant="outline" size="sm">
//             <Link href="/admin/results">Back to results</Link>
//           </Button>
//         }
//       />

//       <div className="grid lg:grid-cols-3 gap-4 mb-5">
//         <div className="card-soft p-5">
//           <h3 className="font-display font-bold mb-3">Student</h3>
//           <p className="font-semibold">{student.name}</p>
//           <p className="text-sm text-muted-foreground">{student.email}</p>
//         </div>
//         <div className="card-soft p-5">
//           <h3 className="font-display font-bold mb-3">Assessment</h3>
//           <p className="font-semibold">{assessment.title}</p>
//           <p className="text-sm text-muted-foreground">
//             {displayType(assessment.type)} · {assessment.durationMin} min ·{" "}
//             {assessment.totalMarks} marks
//           </p>
//         </div>
//         <div className="card-soft p-5">
//           <h3 className="font-display font-bold mb-3">Attempt</h3>
//           <p className="text-sm capitalize">
//             Status: <strong>{attempt.status.replace("_", " ")}</strong>
//           </p>
//           <p className="text-sm mt-1">
//             Started: {new Date(attempt.startedAt).toLocaleString()}
//           </p>
//           <p className="text-sm mt-1">
//             Submitted:{" "}
//             {attempt.submittedAt
//               ? new Date(attempt.submittedAt).toLocaleString()
//               : "—"}
//           </p>
//           <p className="text-sm mt-1">Time taken: {timeTaken ?? "—"}</p>
//         </div>
//       </div>

//       {proctoringAnalysis && (
//         <AdminProctoringAnalysisReport analysis={proctoringAnalysis} />
//       )}

//       {security && (
//         <AdminSecurityReport
//           summary={security.summary}
//           events={security.events}
//         />
//       )}

//       <AdminProctoringReport
//         securitySettings={assessment.security}
//         recording={recording}
//         securityEvents={security?.events ?? []}
//       />

//       {result ? (
//         <>
//           <div className="card-soft p-5 mb-5">
//             <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
//               <h3 className="font-display font-bold">Scores</h3>
//               <span
//                 className={cn(
//                   "text-xs font-semibold uppercase",
//                   result.evaluationStatus === "completed"
//                     ? "text-success"
//                     : "text-primary",
//                 )}
//               >
//                 Evaluation: {result.evaluationStatus}
//               </span>
//             </div>
//             <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
//               <ScoreTile
//                 label="Objective"
//                 value={`${result.objectiveScore}/${result.objectiveMaxMarks}`}
//               />
//               <ScoreTile
//                 label="Subjective"
//                 value={`${result.subjectiveScore}/${result.subjectiveMaxMarks}`}
//               />
//               <ScoreTile
//                 label="Coding"
//                 value={`${result.codingScore}/${result.codingMaxMarks}`}
//               />
//               <ScoreTile
//                 label="Final"
//                 value={`${result.finalScore}/${result.totalMarks}`}
//               />
//               <ScoreTile
//                 label="Pending"
//                 value={String(result.subjectivePendingCount)}
//               />
//             </div>
//             {result.evaluationStatus === "pending" && (
//               <p className="text-sm text-muted-foreground mt-3">
//                 Grade remaining subjective answers to complete evaluation.
//                 Coding scores are calculated automatically from test cases.
//               </p>
//             )}
//             <div className="mt-4">
//               <Button
//                 size="sm"
//                 onClick={complete}
//                 disabled={pending || result.evaluationStatus === "completed"}
//               >
//                 Mark evaluation complete
//               </Button>
//             </div>
//           </div>

//           {error && (
//             <div className="mb-4 text-sm font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
//               {error}
//             </div>
//           )}
//           {message && (
//             <div className="mb-4 text-sm font-semibold text-success bg-success-soft px-3 py-2 rounded-lg">
//               {message}
//             </div>
//           )}

//           <div className="space-y-4">
//             {result.questions.map((q, i) => {
//               const manual = q.type === "subjective";
//               const draft = drafts[q.questionId] ?? {
//                 marks: String(q.awardedPoints),
//                 feedback: q.feedback,
//               };
//               return (
//                 <div key={q.questionId} className="card-soft p-5">
//                   <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
//                     <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-muted">
//                       Q{i + 1} · {displayType(q.type)} · max {q.points}
//                     </span>
//                     <span
//                       className={cn(
//                         "text-xs font-semibold",
//                         q.evalStatus === "correct" && "text-success",
//                         q.evalStatus === "incorrect" && "text-danger",
//                         q.evalStatus === "pending_evaluation" && "text-primary",
//                         q.evalStatus === "manually_graded" && "text-success",
//                         q.evalStatus === "auto_graded" && "text-success",
//                       )}
//                     >
//                       {labelForEval(q.evalStatus, q.awardedPoints)}
//                     </span>
//                   </div>
//                   <p className="font-medium whitespace-pre-wrap mb-3">
//                     {q.prompt}
//                   </p>

//                   {q.type === "mcq" ? (
//                     <div className="text-sm text-muted-foreground space-y-1">
//                       <p>
//                         Student answer:{" "}
//                         <strong className="text-foreground">
//                           {q.selectedOptionKey || "—"}
//                         </strong>
//                       </p>
//                       <p>
//                         Correct answer:{" "}
//                         <strong className="text-foreground">
//                           {q.correctOptionKey || "—"}
//                         </strong>
//                       </p>
//                       <p>
//                         Auto marks:{" "}
//                         <strong className="text-foreground">
//                           {q.awardedPoints}/{q.points}
//                         </strong>
//                       </p>
//                     </div>
//                   ) : q.type === "coding" ? (
//                     <div className="space-y-3">
//                       <div className="text-sm text-muted-foreground space-y-1">
//                         <p>
//                           Language:{" "}
//                           <strong className="text-foreground">
//                             {q.selectedOptionKey || "—"}
//                           </strong>
//                         </p>
//                         <p>
//                           Tests passed:{" "}
//                           <strong className="text-foreground">
//                             {q.passedTests}/{q.totalTests}
//                           </strong>
//                         </p>
//                         <p>
//                           Coding score:{" "}
//                           <strong className="text-foreground">
//                             {q.awardedPoints}/{q.points}
//                           </strong>
//                         </p>
//                         {q.gradedAt && (
//                           <p>
//                             Graded at:{" "}
//                             <strong className="text-foreground">
//                               {new Date(q.gradedAt).toLocaleString()}
//                             </strong>
//                           </p>
//                         )}
//                         {q.feedback?.trim() && (
//                           <p>
//                             Status:{" "}
//                             <strong className="text-foreground">
//                               {q.feedback}
//                             </strong>
//                           </p>
//                         )}
//                       </div>
//                       <pre className="text-xs whitespace-pre-wrap rounded-lg bg-slate-950 text-slate-100 font-mono p-3">
//                         {q.textAnswer.trim() || "No code submitted."}
//                       </pre>
//                       <div className="grid md:grid-cols-[140px_1fr_auto] gap-3 items-end">
//                         <div>
//                           <label className="text-xs font-semibold text-muted-foreground">
//                             Override marks (0–{q.points})
//                           </label>
//                           <Input
//                             type="number"
//                             min={0}
//                             max={q.points}
//                             step={0.5}
//                             className="mt-1.5"
//                             value={draft.marks}
//                             onChange={(e) =>
//                               setDrafts((prev) => ({
//                                 ...prev,
//                                 [q.questionId]: {
//                                   ...draft,
//                                   marks: e.target.value,
//                                 },
//                               }))
//                             }
//                           />
//                         </div>
//                         <div>
//                           <label className="text-xs font-semibold text-muted-foreground">
//                             Feedback
//                           </label>
//                           <Input
//                             className="mt-1.5"
//                             value={draft.feedback}
//                             onChange={(e) =>
//                               setDrafts((prev) => ({
//                                 ...prev,
//                                 [q.questionId]: {
//                                   ...draft,
//                                   feedback: e.target.value,
//                                 },
//                               }))
//                             }
//                             placeholder="Optional override note"
//                           />
//                         </div>
//                         <Button
//                           size="sm"
//                           disabled={pending}
//                           onClick={() => saveGrade(q.questionId)}
//                         >
//                           Override grade
//                         </Button>
//                       </div>
//                     </div>
//                   ) : (
//                     <>
//                       <pre className="text-sm whitespace-pre-wrap rounded-lg bg-muted/50 p-3 mb-4">
//                         {q.textAnswer.trim() || "No answer submitted."}
//                       </pre>
//                       {manual && (
//                         <div className="grid md:grid-cols-[140px_1fr_auto] gap-3 items-end">
//                           <div>
//                             <label className="text-xs font-semibold text-muted-foreground">
//                               Marks (0–{q.points})
//                             </label>
//                             <Input
//                               type="number"
//                               min={0}
//                               max={q.points}
//                               step={0.5}
//                               className="mt-1.5"
//                               value={draft.marks}
//                               onChange={(e) =>
//                                 setDrafts((prev) => ({
//                                   ...prev,
//                                   [q.questionId]: {
//                                     ...draft,
//                                     marks: e.target.value,
//                                   },
//                                 }))
//                               }
//                             />
//                           </div>
//                           <div>
//                             <label className="text-xs font-semibold text-muted-foreground">
//                               Feedback
//                             </label>
//                             <Input
//                               className="mt-1.5"
//                               value={draft.feedback}
//                               onChange={(e) =>
//                                 setDrafts((prev) => ({
//                                   ...prev,
//                                   [q.questionId]: {
//                                     ...draft,
//                                     feedback: e.target.value,
//                                   },
//                                 }))
//                               }
//                               placeholder="Optional feedback for student"
//                             />
//                           </div>
//                           <Button
//                             size="sm"
//                             disabled={pending}
//                             onClick={() => saveGrade(q.questionId)}
//                           >
//                             Save grade
//                           </Button>
//                           <div className="md:col-span-3 flex flex-wrap items-center gap-3">
//                             <Button
//                               type="button"
//                               size="sm"
//                               variant="outline"
//                               disabled={Boolean(suggestingId)}
//                               onClick={() => suggestGrade(q.questionId)}
//                             >
//                               {suggestingId === q.questionId
//                                 ? "Suggesting…"
//                                 : "Suggest with AI"}
//                             </Button>
//                             <p className="text-xs text-muted-foreground">
//                               Suggestion only. Save grade writes the final marks.
//                             </p>
//                           </div>
//                         </div>
//                       )}
//                     </>
//                   )}
//                 </div>
//               );
//             })}
//           </div>
//         </>
//       ) : (
//         <div className="card-soft p-8 text-center text-muted-foreground">
//           This attempt is still in progress. Grading unlocks after submission.
//         </div>
//       )}
//     </div>
//   );
// }

// function ScoreTile({ label, value }: { label: string; value: string }) {
//   return (
//     <div className="rounded-xl border border-border p-3">
//       <div className="text-[11px] text-muted-foreground">{label}</div>
//       <div className="font-display font-bold text-lg mt-1">{value}</div>
//     </div>
//   );
// }

// function labelForEval(status: string, awarded: number) {
//   if (status === "correct") return `Correct (+${awarded})`;
//   if (status === "incorrect") return "Incorrect";
//   if (status === "pending_evaluation") return "Pending evaluation";
//   if (status === "manually_graded") return `Manually graded (+${awarded})`;
//   if (status === "auto_graded") return `Auto graded (+${awarded})`;
//   return status;
// }












"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { ComponentType, CSSProperties, ReactNode } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  Copy,
  ListChecks,
  Loader2,
  Minus,
  PenLine,
  Plus,
  Sparkles,
  Target,
  Timer,
  Undo2,
  X,
} from "lucide-react";
import {
  completeEvaluationAction,
  gradeQuestionAction,
  suggestSubjectiveGradeAction,
} from "@/lib/actions/grading";
import type { SerializedAttempt, SerializedResult } from "@/lib/serializers";
import { displayType } from "@/lib/serializers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { AdminSecurityReport } from "@/components/admin/admin-security-report";
import { AdminProctoringAnalysisReport } from "@/components/admin/admin-proctoring-analysis-report";
import { AdminProctoringReport } from "@/components/admin/admin-proctoring-report";
import { cn } from "@/lib/utils";
import type { SecuritySummary } from "@/lib/exam/security";
import type { SerializedSecurityEvent } from "@/lib/actions/exam-security";
import type { SerializedExamRecording } from "@/lib/actions/exam-recording";
import type { ProctoringAnalysis } from "@/lib/proctoring/analyze";
import type { AssessmentSecuritySettings } from "@/types/assessment-security";

/* ================================================================== */
/* Types                                                               */
/* ================================================================== */

type Question = SerializedResult["questions"][number];
type Draft = { marks: string; feedback: string };
type Suggestion = { prev: Draft; marks: string; feedback: string };
type Notice = { kind: "success" | "error"; text: string; id: number } | null;
type Filter = "all" | "needs_grading" | "auto";
type Tone = "pending" | "good" | "bad";

type GradeProps = {
  draft: Draft;
  dirty: boolean;
  marksValid: boolean;
  saving: boolean;
  saved: boolean;
  error?: string;
  onChange: (patch: Partial<Draft>) => void;
  onSave: () => void;
};

type AiProps = {
  loading: boolean;
  busyElsewhere: boolean;
  flash: boolean;
  suggestion?: Suggestion;
  onSuggest: () => void;
  onUndo: () => void;
  onDismiss: () => void;
};

const AI_STEPS = [
  "Reading the answer…",
  "Comparing with the question…",
  "Drafting marks and feedback…",
];

/* ================================================================== */
/* Design tokens (Tailwind class strings)                              */
/* ================================================================== */

/** Frosted-glass surface. Add your own radius + `relative`/`sticky`. */
const GLASS =
  "border border-border/50 bg-background/60 backdrop-blur-xl shadow-[0_12px_48px_-18px_rgba(15,23,42,0.28),inset_0_1px_0_0_rgba(255,255,255,0.5)] dark:shadow-[0_12px_48px_-18px_rgba(0,0,0,0.7),inset_0_1px_0_0_rgba(255,255,255,0.07)]";

const GLASS_CARD =
  "relative scroll-mt-24 overflow-hidden rounded-2xl border border-border/50 bg-background/60 backdrop-blur-lg shadow-[0_8px_30px_-14px_rgba(15,23,42,0.25),inset_0_1px_0_0_rgba(255,255,255,0.45)] transition-all duration-300 hover:border-border hover:shadow-[0_18px_46px_-16px_rgba(15,23,42,0.32),inset_0_1px_0_0_rgba(255,255,255,0.5)] lg:scroll-mt-6 dark:shadow-[0_8px_30px_-14px_rgba(0,0,0,0.65),inset_0_1px_0_0_rgba(255,255,255,0.06)]";

const RISE =
  "animate-[aad-rise_.7s_cubic-bezier(.2,.8,.2,1)_backwards]";

const TONE: Record<
  Tone,
  { text: string; tile: string; chip: string; bar: string; stroke: string }
> = {
  pending: {
    text: "text-primary",
    tile: "bg-gradient-to-br from-primary/25 to-primary/5 text-primary ring-1 ring-inset ring-primary/25",
    chip: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/30",
    bar: "from-primary to-primary/20",
    stroke: "stroke-primary",
  },
  good: {
    text: "text-success",
    tile: "bg-gradient-to-br from-success/25 to-success/5 text-success ring-1 ring-inset ring-success/25",
    chip: "bg-success-soft text-success ring-1 ring-inset ring-success/30",
    bar: "from-success to-success/20",
    stroke: "stroke-success",
  },
  bad: {
    text: "text-danger",
    tile: "bg-gradient-to-br from-danger/25 to-danger/5 text-danger ring-1 ring-inset ring-danger/25",
    chip: "bg-danger-soft text-danger ring-1 ring-inset ring-danger/30",
    bar: "from-danger to-danger/20",
    stroke: "stroke-danger",
  },
};

/**
 * Keyframes + the few rules Tailwind utilities cannot express
 * (@property, mask-composite, range-thumb pseudo-elements).
 * Animations are applied from JSX with Tailwind's `animate-[aad-…]` utilities.
 * Re-theme the AI colours by changing the three --aad-ai-* RGB triples.
 */
const GLOBAL_CSS = `
@property --aad-angle { syntax: "<angle>"; initial-value: 0deg; inherits: false; }

.aad-root { --aad-ai-1: 139 92 246; --aad-ai-2: 56 189 248; --aad-ai-3: 232 121 249; }

@keyframes aad-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes aad-pop { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes aad-swap { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
@keyframes aad-float { 0%, 100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(28px,-22px,0) scale(1.07); } }
@keyframes aad-scan { from { transform: translateY(-100%); } to { transform: translateY(300%); } }
@keyframes aad-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes aad-sparkle { 0%, 100% { transform: scale(1) rotate(0deg); } 50% { transform: scale(1.25) rotate(14deg); } }
@keyframes aad-caret { 50% { opacity: 0; } }
@keyframes aad-toast-in { from { opacity: 0; transform: translateX(28px) scale(.96); } to { opacity: 1; transform: none; } }
@keyframes aad-toast-bar { from { width: 100%; } to { width: 0%; } }
@keyframes aad-burst { 0% { opacity: 1; transform: translate(0,0) scale(1); } 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(.2); } }
@keyframes aad-breathe { 0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, currentColor 38%, transparent); } 50% { box-shadow: 0 0 0 6px color-mix(in srgb, currentColor 0%, transparent); } }
@keyframes aad-angle { to { --aad-angle: 360deg; } }

/* Rotating gradient border ("aurora") drawn as a masked 1.5px ring */
.aad-aurora {
  position: absolute; inset: 0; border-radius: inherit; padding: 1.5px; pointer-events: none;
  background: conic-gradient(from var(--aad-angle),
    rgb(var(--aad-ai-1) / 0) 0%, rgb(var(--aad-ai-1)) 14%, rgb(var(--aad-ai-2)) 30%,
    rgb(var(--aad-ai-3)) 44%, rgb(var(--aad-ai-1) / 0) 58%, rgb(var(--aad-ai-1) / 0) 100%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  mask-composite: exclude;
  animation: aad-angle 3s linear infinite;
}

/* Marks slider */
.aad-range {
  -webkit-appearance: none; appearance: none; height: 8px; border-radius: 999px; cursor: pointer; outline: none;
  background: linear-gradient(to right, currentColor var(--aad-fill, 0%), rgb(148 163 184 / .28) var(--aad-fill, 0%));
}
.aad-range::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none; width: 22px; height: 22px; margin-top: -7px; border-radius: 999px;
  background: #fff; border: 3px solid currentColor; box-shadow: 0 4px 14px -2px rgb(15 23 42 / .35);
  transition: transform .15s ease, box-shadow .15s ease;
}
.aad-range::-moz-range-thumb {
  width: 16px; height: 16px; border-radius: 999px; background: #fff; border: 3px solid currentColor;
  box-shadow: 0 4px 14px -2px rgb(15 23 42 / .35); transition: transform .15s ease, box-shadow .15s ease;
}
.aad-range::-moz-range-track { background: transparent; }
.aad-range:hover::-webkit-slider-thumb { transform: scale(1.12); }
.aad-range:active::-webkit-slider-thumb { transform: scale(.94); }
.aad-range:hover::-moz-range-thumb { transform: scale(1.12); }
.aad-range:focus-visible::-webkit-slider-thumb { box-shadow: 0 0 0 5px color-mix(in srgb, currentColor 25%, transparent); }
.aad-range:focus-visible::-moz-range-thumb { box-shadow: 0 0 0 5px color-mix(in srgb, currentColor 25%, transparent); }

@media (prefers-reduced-motion: reduce) {
  .aad-root [class*="animate-[aad-"], .aad-root .aad-aurora { animation: none !important; }
}
`;

/* ================================================================== */
/* Helpers + hooks (unchanged behaviour)                               */
/* ================================================================== */

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const clamp = (n: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, n));

const fmt = (n: number) => String(Math.round(n * 10) / 10);

function toneOf(q: Question): Tone {
  if (q.evalStatus === "pending_evaluation") return "pending";
  if (q.evalStatus === "incorrect") return "bad";
  return "good";
}

function typeIcon(type: string) {
  if (type === "coding") return Code2;
  if (type === "mcq") return ListChecks;
  return PenLine;
}

function useMounted(delay = 60) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(t);
  }, [delay]);
  return mounted;
}

/** Animates a number toward `target`. Pass `initial` to count up on first render. */
function useCountUp(target: number, duration = 800, initial?: number) {
  const [value, setValue] = useState(initial ?? target);
  const current = useRef(initial ?? target);

  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    const origin = current.current;
    if (origin === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = origin + (target - origin) * eased;
      current.current = v;
      setValue(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

function useTypewriter(text: string, speed = 16) {
  const [out, setOut] = useState("");
  useEffect(() => {
    if (prefersReducedMotion()) {
      setOut(text);
      return;
    }
    setOut("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return out;
}

/** Which of the three AI phases is showing while a suggestion is loading. */
function useAiStep(loading: boolean) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    const t = setInterval(
      () => setStep((s) => Math.min(s + 1, AI_STEPS.length - 1)),
      2000,
    );
    return () => clearInterval(t);
  }, [loading]);
  return step;
}

/* ================================================================== */
/* Main component (state + handlers identical to the previous version) */
/* ================================================================== */

export function AdminAttemptDetailClient({
  attempt: initialAttempt,
  student,
  assessment,
  result: initialResult,
  timeTaken,
  security,
  recording = null,
  proctoringAnalysis = null,
}: {
  attempt: SerializedAttempt;
  student: { id: string; name: string; email: string };
  assessment: {
    id: string;
    title: string;
    type: string;
    durationMin: number;
    totalMarks: number;
    security?: AssessmentSecuritySettings;
  };
  result: SerializedResult | null;
  timeTaken: string | null;
  security?: {
    summary: SecuritySummary;
    events: SerializedSecurityEvent[];
  } | null;
  recording?: SerializedExamRecording | null;
  proctoringAnalysis?: ProctoringAnalysis | null;
}) {
  /* ---------- state ---------- */
  const [attempt] = useState(initialAttempt);
  const [result, setResult] = useState(initialResult);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const map: Record<string, Draft> = {};
    for (const q of initialResult?.questions ?? []) {
      if (q.type !== "mcq") {
        map[q.questionId] = {
          marks: String(q.awardedPoints ?? 0),
          feedback: q.feedback ?? "",
        };
      }
    }
    return map;
  });

  const [notice, setNotice] = useState<Notice>(null);
  const [questionErrors, setQuestionErrors] = useState<Record<string, string>>(
    {},
  );
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>(
    {},
  );
  const [suggestingId, setSuggestingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [completing, startComplete] = useTransition();
  const [, startSave] = useTransition();

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [activeQ, setActiveQ] = useState<string | null>(null);

  const showNotice = (kind: "success" | "error", text: string) =>
    setNotice({ kind, text, id: Date.now() });

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(t);
  }, [notice]);

  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 1800);
    return () => clearTimeout(t);
  }, [flashId]);

  useEffect(() => {
    if (!savedId) return;
    const t = setTimeout(() => setSavedId(null), 2200);
    return () => clearTimeout(t);
  }, [savedId]);

  const setQuestionError = (id: string, text: string) =>
    setQuestionErrors((prev) => {
      const next = { ...prev };
      if (text) next[id] = text;
      else delete next[id];
      return next;
    });

  const updateDraft = (q: Question, patch: Partial<Draft>) =>
    setDrafts((prev) => {
      const current = prev[q.questionId] ?? {
        marks: String(q.awardedPoints),
        feedback: q.feedback ?? "",
      };
      return { ...prev, [q.questionId]: { ...current, ...patch } };
    });

  /* ---------- server action handlers ---------- */
  const saveGrade = (questionId: string) => {
    const draft = drafts[questionId];
    if (!draft || savingId) return;
    setQuestionError(questionId, "");
    setSavingId(questionId);
    startSave(async () => {
      try {
        const res = await gradeQuestionAction({
          attemptId: attempt.id,
          questionId,
          marks: Number(draft.marks),
          feedback: draft.feedback,
        });
        if ("error" in res && res.error) {
          setQuestionError(questionId, res.error);
          return;
        }
        if ("result" in res && res.result) {
          setResult(res.result);
          setSuggestions((prev) => {
            const next = { ...prev };
            delete next[questionId];
            return next;
          });
          setSavedId(questionId);
          showNotice("success", "Grade saved. Score updated.");
        }
      } catch {
        setQuestionError(questionId, "Could not save the grade. Try again.");
      } finally {
        setSavingId(null);
      }
    });
  };

  const suggestGrade = async (questionId: string) => {
    if (suggestingId) return;
    setQuestionError(questionId, "");
    setSuggestingId(questionId);
    try {
      const res = await suggestSubjectiveGradeAction({
        attempt: attempt,
        attemptId: attempt.id,
        questionId,
      });
      if ("error" in res && res.error) {
        setQuestionError(questionId, res.error);
        return;
      }
      if ("suggestedMarks" in res) {
        const prev = drafts[questionId] ?? { marks: "0", feedback: "" };
        const next: Draft = {
          marks: String(res.suggestedMarks),
          feedback: res.feedback,
        };
        setDrafts((d) => ({ ...d, [questionId]: next }));
        setSuggestions((s) => ({
          ...s,
          [questionId]: { prev: s[questionId]?.prev ?? prev, ...next },
        }));
        setFlashId(questionId);
      }
    } catch {
      setQuestionError(
        questionId,
        "AI grading is unavailable right now. Grade this answer manually.",
      );
    } finally {
      setSuggestingId(null);
    }
  };

  const dismissSuggestion = (questionId: string) =>
    setSuggestions((prev) => {
      const next = { ...prev };
      delete next[questionId];
      return next;
    });

  const undoSuggestion = (questionId: string) => {
    const s = suggestions[questionId];
    if (!s) return;
    setDrafts((d) => ({ ...d, [questionId]: s.prev }));
    dismissSuggestion(questionId);
  };

  const complete = () => {
    setNotice(null);
    startComplete(async () => {
      const res = await completeEvaluationAction(attempt.id);
      if ("error" in res && res.error) {
        showNotice("error", res.error);
        return;
      }
      if ("result" in res && res.result) {
        setResult(res.result);
        showNotice("success", "Evaluation marked complete.");
      }
    });
  };

  /* ---------- derived ---------- */
  const stats = useMemo(() => {
    if (!result) return null;
    const total = result.questions.filter((q) => q.type === "subjective").length;
    const graded = Math.max(0, total - result.subjectivePendingCount);
    return {
      total,
      graded,
      percent: total === 0 ? 100 : Math.round((graded / total) * 100),
    };
  }, [result]);

  const isDirty = (q: Question) => {
    const d = drafts[q.questionId];
    if (!d) return false;
    return d.marks !== String(q.awardedPoints) || d.feedback !== (q.feedback ?? "");
  };

  const visibleQuestions = useMemo(() => {
    if (!result) return [];
    return result.questions
      .map((q, index) => ({ q, index }))
      .filter(({ q }) => {
        if (filter === "needs_grading")
          return q.type === "subjective" && q.evalStatus === "pending_evaluation";
        if (filter === "auto") return q.type !== "subjective";
        return true;
      });
  }, [result, filter]);

  // MCQs start collapsed (nothing to do there); written and coding answers start open.
  const isOpen = (q: Question) => open[q.questionId] ?? q.type !== "mcq";
  const toggle = (q: Question) =>
    setOpen((p) => ({ ...p, [q.questionId]: !isOpen(q) }));
  const setAllOpen = (value: boolean) => {
    if (!result) return;
    const map: Record<string, boolean> = {};
    for (const q of result.questions) map[q.questionId] = value;
    setOpen(map);
  };

  const jumpTo = (q: Question) => {
    setOpen((p) => ({ ...p, [q.questionId]: true }));
    setActiveQ(q.questionId);
    const go = () =>
      document
        .getElementById(`q-${q.questionId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (filter !== "all") {
      setFilter("all");
      setTimeout(go, 80);
    } else {
      requestAnimationFrame(go);
    }
  };

  // Highlight the question currently in view in the navigator.
  useEffect(() => {
    if (!result) return;
    const els = visibleQuestions
      .map(({ q }) => document.getElementById(`q-${q.questionId}`))
      .filter(Boolean) as HTMLElement[];
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveQ(visible[0].target.id.replace("q-", ""));
      },
      { rootMargin: "-25% 0px -60% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [result, visibleQuestions]);

  const ready =
    !!result &&
    result.evaluationStatus !== "completed" &&
    result.subjectivePendingCount === 0;

  /* ---------- render ---------- */
  return (
    <div className="aad-root relative isolate">
      <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
      <Backdrop />

      <PageHeader
        title="Attempt details"
        description={assessment.title}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/results">Back to results</Link>
          </Button>
        }
      />

      <HeaderCard
        student={student}
        assessment={assessment}
        attempt={attempt}
        timeTaken={timeTaken}
      />

      {proctoringAnalysis && (
        <AdminProctoringAnalysisReport analysis={proctoringAnalysis} />
      )}

      {security && (
        <AdminSecurityReport
          summary={security.summary}
          events={security.events}
        />
      )}

      <AdminProctoringReport
        securitySettings={assessment.security}
        recording={recording}
        securityEvents={security?.events ?? []}
      />

      {result && stats ? (
        <>
          <ScoreSummary
            result={result}
            stats={stats}
            ready={ready}
            completing={completing}
            onComplete={complete}
          />

          <div
            className={cn(
              "grid items-start gap-5 lg:grid-cols-[248px_minmax(0,1fr)] [animation-delay:240ms]",
              RISE,
            )}
          >
            <QuestionRail
              result={result}
              stats={stats}
              activeQ={activeQ}
              isDirty={isDirty}
              onJump={jumpTo}
              ready={ready}
              completing={completing}
              onComplete={complete}
            />

            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <FilterTabs
                  filter={filter}
                  onChange={setFilter}
                  toGrade={result.subjectivePendingCount}
                />
                <div className="flex items-center gap-2">
                  <PillButton
                    icon={ChevronsUpDown}
                    onClick={() => setAllOpen(true)}
                  >
                    Expand all
                  </PillButton>
                  <PillButton
                    icon={ChevronsDownUp}
                    onClick={() => setAllOpen(false)}
                  >
                    Collapse all
                  </PillButton>
                </div>
              </div>

              <div className="space-y-4">
                {visibleQuestions.length === 0 && (
                  <div
                    className={cn(
                      GLASS,
                      "relative overflow-hidden rounded-3xl p-12 text-center",
                    )}
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-6 size-40 -translate-x-1/2 rounded-full bg-success/20 blur-3xl"
                    />
                    <div className="relative mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-success-soft text-success shadow-lg shadow-success/20">
                      <Check className="size-7" />
                    </div>
                    <p className="relative font-display text-lg font-semibold">
                      {filter === "needs_grading"
                        ? "Nothing left to grade"
                        : "No questions match this filter"}
                    </p>
                    <p className="relative mt-1 text-sm text-muted-foreground">
                      {filter === "needs_grading"
                        ? "Mark the evaluation complete when you are ready."
                        : "Try a different filter."}
                    </p>
                  </div>
                )}

                {visibleQuestions.map(({ q, index }) => {
                  const draft = drafts[q.questionId] ?? {
                    marks: String(q.awardedPoints),
                    feedback: q.feedback ?? "",
                  };
                  const marksNum = Number(draft.marks);
                  const marksValid =
                    draft.marks.trim() !== "" &&
                    !Number.isNaN(marksNum) &&
                    marksNum >= 0 &&
                    marksNum <= q.points;

                  const grade: GradeProps = {
                    draft,
                    dirty: isDirty(q),
                    marksValid,
                    saving: savingId === q.questionId,
                    saved: savedId === q.questionId,
                    error: questionErrors[q.questionId],
                    onChange: (patch) => updateDraft(q, patch),
                    onSave: () => saveGrade(q.questionId),
                  };

                  const ai: AiProps | undefined =
                    q.type === "subjective"
                      ? {
                          loading: suggestingId === q.questionId,
                          busyElsewhere:
                            Boolean(suggestingId) &&
                            suggestingId !== q.questionId,
                          flash: flashId === q.questionId,
                          suggestion: suggestions[q.questionId],
                          onSuggest: () => suggestGrade(q.questionId),
                          onUndo: () => undoSuggestion(q.questionId),
                          onDismiss: () => dismissSuggestion(q.questionId),
                        }
                      : undefined;

                  return (
                    <QuestionCard
                      key={q.questionId}
                      q={q}
                      index={index}
                      open={isOpen(q)}
                      active={activeQ === q.questionId}
                      onToggle={() => toggle(q)}
                      grade={grade}
                      ai={ai}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div
          className={cn(
            GLASS,
            "relative overflow-hidden rounded-3xl p-14 text-center",
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-4 size-44 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"
          />
          <div className="relative mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Timer className="size-7" />
          </div>
          <p className="relative font-display text-lg font-semibold">
            Attempt in progress
          </p>
          <p className="relative mt-1 text-sm text-muted-foreground">
            Grading unlocks after the student submits.
          </p>
        </div>
      )}

      <Toast notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

/* ================================================================== */
/* Ambient backdrop (gives the glass something to blur)                */
/* ================================================================== */

function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none sticky top-0 -z-10 -mb-[100vh] h-screen overflow-hidden"
    >
      <div className="absolute -left-32 -top-32 size-[30rem] rounded-full bg-primary/20 blur-3xl motion-safe:animate-[aad-float_16s_ease-in-out_infinite]" />
      <div className="absolute -right-24 top-1/4 size-[26rem] rounded-full bg-sky-400/20 blur-3xl motion-safe:animate-[aad-float_20s_ease-in-out_infinite_reverse]" />
      <div className="absolute bottom-0 left-1/3 size-[28rem] rounded-full bg-violet-400/15 blur-3xl motion-safe:animate-[aad-float_18s_ease-in-out_infinite]" />
    </div>
  );
}

/* ================================================================== */
/* Header                                                              */
/* ================================================================== */

function HeaderCard({
  student,
  assessment,
  attempt,
  timeTaken,
}: {
  student: { id: string; name: string; email: string };
  assessment: {
    title: string;
    type: string;
    durationMin: number;
    totalMarks: number;
  };
  attempt: SerializedAttempt;
  timeTaken: string | null;
}) {
  const initials =
    student.name
      .split(" ")
      .filter(Boolean)
      .map((s) => s[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const started = new Date(attempt.startedAt);
  const submitted = attempt.submittedAt ? new Date(attempt.submittedAt) : null;
  const live = attempt.status.includes("progress");

  return (
    <section
      className={cn(
        GLASS,
        RISE,
        "relative mb-5 overflow-hidden rounded-3xl",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 size-80 rounded-full bg-primary/20 blur-3xl"
      />
      <div className="relative grid gap-8 p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center">
        {/* Identity */}
        <div className="flex items-center gap-5">
          <div className="relative shrink-0">
            <div
              aria-hidden
              className="absolute inset-0 rounded-3xl bg-primary/40 blur-xl"
            />
            <div className="relative grid size-[72px] place-items-center rounded-3xl bg-gradient-to-br from-primary to-primary/60 font-display text-2xl font-bold text-primary-foreground shadow-lg shadow-primary/30 ring-1 ring-inset ring-white/30">
              {initials}
            </div>
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-2xl font-bold tracking-tight">
              {student.name}
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {student.email}
            </p>
            <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-semibold capitalize backdrop-blur-md">
              <span className="relative flex size-2">
                {live && (
                  <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
                )}
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              {attempt.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Assessment + timeline */}
        <div className="min-w-0">
          <p className="truncate font-display text-lg font-semibold tracking-tight">
            {assessment.title}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <Chip icon={ListChecks}>{displayType(assessment.type)}</Chip>
            <Chip icon={Timer}>{assessment.durationMin} min</Chip>
            <Chip icon={Target}>{assessment.totalMarks} marks</Chip>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <TimeNode icon={CalendarDays} label="Started" date={started} />
            <div className="relative min-w-8 flex-1">
              <div className="h-px w-full bg-gradient-to-r from-border via-primary/60 to-border" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border/60 bg-background/80 px-2.5 py-0.5 text-[11px] font-semibold tabular-nums backdrop-blur-md">
                {timeTaken ?? "—"}
              </span>
            </div>
            <TimeNode
              icon={Check}
              label="Submitted"
              date={submitted}
              align="right"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function Chip({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur-md">
      <Icon className="size-3.5 text-primary" />
      {children}
    </span>
  );
}

function TimeNode({
  icon: Icon,
  label,
  date,
  align = "left",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  date: Date | null;
  align?: "left" | "right";
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2.5",
        align === "right" && "flex-row-reverse text-right",
      )}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl border border-border/60 bg-background/70 text-primary shadow-sm">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p
          suppressHydrationWarning
          className="text-sm font-semibold tabular-nums"
        >
          {date ? date.toLocaleDateString() : "—"}
        </p>
        <p
          suppressHydrationWarning
          className="text-xs tabular-nums text-muted-foreground"
        >
          {date
            ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            : ""}
        </p>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Score summary                                                       */
/* ================================================================== */

function ScoreSummary({
  result,
  stats,
  ready,
  completing,
  onComplete,
}: {
  result: SerializedResult;
  stats: { total: number; graded: number; percent: number };
  ready: boolean;
  completing: boolean;
  onComplete: () => void;
}) {
  const percent =
    result.totalMarks > 0 ? (result.finalScore / result.totalMarks) * 100 : 0;
  const finalShown = useCountUp(result.finalScore, 1000, 0);
  const completed = result.evaluationStatus === "completed";

  const rows = [
    {
      label: "Objective",
      icon: ListChecks,
      score: result.objectiveScore,
      max: result.objectiveMaxMarks,
    },
    {
      label: "Subjective",
      icon: PenLine,
      score: result.subjectiveScore,
      max: result.subjectiveMaxMarks,
    },
    {
      label: "Coding",
      icon: Code2,
      score: result.codingScore,
      max: result.codingMaxMarks,
    },
  ].filter((r) => r.max > 0);

  return (
    <section
      className={cn(
        GLASS,
        RISE,
        "relative mb-5 overflow-hidden rounded-3xl p-6 [animation-delay:120ms] md:p-8",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-sky-400/15 blur-3xl"
      />
      <div className="relative grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        {/* Ring + headline number */}
        <div className="flex items-center gap-6">
          <ScoreRing percent={percent} />
          <div>
            <p className="text-sm text-muted-foreground">Final score</p>
            <p className="font-display text-5xl font-bold leading-none tracking-tight tabular-nums">
              {fmt(finalShown)}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">
              out of {result.totalMarks} marks
            </p>
            <span
              className={cn(
                "mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                completed
                  ? "bg-success-soft text-success"
                  : "bg-primary/10 text-primary",
              )}
            >
              {completed ? (
                <Check className="size-3.5" />
              ) : (
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full rounded-full bg-primary opacity-60 motion-safe:animate-ping" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
              )}
              {completed ? "Evaluation complete" : "Evaluation pending"}
            </span>
          </div>
        </div>

        {/* Breakdown + progress */}
        <div className="space-y-6">
          <div
            className={cn(
              "grid gap-3",
              rows.length >= 3
                ? "sm:grid-cols-3"
                : rows.length === 2
                  ? "sm:grid-cols-2"
                  : "sm:grid-cols-1",
            )}
          >
            {rows.map((r, i) => {
              const pct = (r.score / r.max) * 100;
              return (
                <div
                  key={r.label}
                  className="group/tile rounded-2xl border border-border/50 bg-background/40 p-4 backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-background/70 hover:shadow-lg hover:shadow-primary/10"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 group-hover/tile:rotate-3 group-hover/tile:scale-110">
                      <r.icon className="size-4" />
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {Math.round(pct)}%
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {r.label}
                  </p>
                  <p className="font-display text-2xl font-bold tracking-tight tabular-nums">
                    {r.score}
                    <span className="text-sm font-semibold text-muted-foreground">
                      {" "}
                      / {r.max}
                    </span>
                  </p>
                  <Meter value={pct} delay={i * 120} className="mt-3" />
                </div>
              );
            })}
          </div>

          <GradingSteps graded={stats.graded} total={stats.total} />

          {!completed && !ready && stats.total > 0 && (
            <p className="text-xs text-muted-foreground">
              Coding scores come from test cases automatically.
            </p>
          )}
          {ready && (
            <p className="animate-[aad-pop_.4s_ease-out_backwards] text-sm font-medium text-success">
              Every written answer is graded. Mark the evaluation complete to
              finish.
            </p>
          )}

          <div className="lg:hidden">
            <CompleteButton
              ready={ready}
              completed={completed}
              completing={completing}
              onClick={onComplete}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function ScoreRing({ percent }: { percent: number }) {
  const mounted = useMounted(120);
  const gid = useId().replace(/:/g, "");
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (mounted ? clamp(percent) / 100 : 0));
  const shown = useCountUp(percent, 1000, 0);

  return (
    <div
      className="relative size-36 shrink-0 md:size-44"
      role="img"
      aria-label={`Final score ${Math.round(percent)} percent`}
    >
      <svg viewBox="0 0 100 100" className="size-full -rotate-90 overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" className="text-primary" stopColor="currentColor" />
            <stop
              offset="100%"
              className="text-primary"
              stopColor="currentColor"
              stopOpacity={0.55}
            />
          </linearGradient>
        </defs>
        {/* dotted outer scale */}
        <circle
          cx="50"
          cy="50"
          r="48.5"
          fill="none"
          strokeWidth="0.7"
          strokeDasharray="0.6 3.2"
          className="stroke-muted-foreground/40"
        />
        {/* track */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="7"
          className="stroke-muted/80"
        />
        {/* glow copy */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={`url(#${gid})`}
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="opacity-60 blur-[5px] transition-[stroke-dashoffset] duration-1000 ease-out"
        />
        {/* arc */}
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          stroke={`url(#${gid})`}
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-3xl font-bold tracking-tight tabular-nums md:text-4xl">
          {Math.round(shown)}
          <span className="text-lg text-muted-foreground">%</span>
        </span>
      </div>
    </div>
  );
}

function Meter({
  value,
  className,
  barClassName,
  delay = 0,
}: {
  value: number;
  className?: string;
  barClassName?: string;
  delay?: number;
}) {
  const mounted = useMounted();
  return (
    <div
      aria-hidden
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted/70", className)}
    >
      <div
        className={cn(
          "h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-[width] duration-700 ease-out",
          barClassName,
        )}
        style={{
          width: mounted ? `${clamp(value)}%` : "0%",
          transitionDelay: `${delay}ms`,
        }}
      />
    </div>
  );
}

function GradingSteps({ graded, total }: { graded: number; total: number }) {
  const mounted = useMounted(200);
  if (total === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No written answers to grade.
      </p>
    );
  }
  const pct = Math.round((graded / total) * 100);
  return (
    <div>
      <div className="mb-2.5 flex items-baseline justify-between gap-3 text-sm">
        <p>
          <strong className="tabular-nums">{graded}</strong> of{" "}
          <strong className="tabular-nums">{total}</strong> written answers
          graded
        </p>
        <span className="text-xs font-semibold tabular-nums text-muted-foreground">
          {pct}%
        </span>
      </div>
      {total <= 24 ? (
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={graded}
          aria-label="Grading progress"
        >
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2 flex-1 rounded-full transition-all duration-500",
                mounted && i < graded
                  ? "bg-gradient-to-r from-primary to-primary/70 shadow-[0_0_10px_-2px] shadow-primary/60"
                  : "bg-muted/70",
              )}
              style={{ transitionDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      ) : (
        <Meter value={pct} />
      )}
    </div>
  );
}

/** Light sweep that crosses a button on hover. The parent needs the plain `group` class. */
function ShineSweep() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100"
    />
  );
}

function CompleteButton({
  ready,
  completed,
  completing,
  onClick,
}: {
  ready: boolean;
  completed: boolean;
  completing: boolean;
  onClick: () => void;
}) {
  return (
    <div className="relative">
      {ready && !completing && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-xl bg-primary/40 motion-safe:animate-ping"
        />
      )}
      <Button
        size="sm"
        onClick={onClick}
        disabled={completing || completed}
        className="group relative h-11 w-full overflow-hidden rounded-xl bg-gradient-to-b from-primary to-primary/85 font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35 active:translate-y-0 active:scale-[0.98] disabled:shadow-none"
      >
        <ShineSweep />
        <span
          key={completing ? "busy" : completed ? "done" : "idle"}
          className="relative flex animate-[aad-swap_.3s_ease-out_backwards] items-center gap-2"
        >
          {completing ? (
            <>
              <Loader2 className="size-4 motion-safe:animate-spin" />
              Completing…
            </>
          ) : completed ? (
            <>
              <Check className="size-4" />
              Evaluation complete
            </>
          ) : (
            "Mark evaluation complete"
          )}
        </span>
      </Button>
    </div>
  );
}

/* ================================================================== */
/* Toolbar                                                             */
/* ================================================================== */

function FilterTabs({
  filter,
  onChange,
  toGrade,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  toGrade: number;
}) {
  const items: [Filter, string][] = [
    ["all", "All"],
    ["needs_grading", "To grade"],
    ["auto", "Auto-graded"],
  ];
  const index = Math.max(
    0,
    items.findIndex(([v]) => v === filter),
  );

  return (
    <div
      role="group"
      aria-label="Filter questions"
      className="relative grid w-full grid-cols-3 rounded-full border border-border/50 bg-background/50 p-1 backdrop-blur-md sm:w-[22rem]"
    >
      <span
        aria-hidden
        className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-primary shadow-md shadow-primary/30 transition-transform duration-300 ease-[cubic-bezier(.2,.8,.2,1)]"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {items.map(([value, label]) => {
        const active = filter === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
              active
                ? "text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {value === "needs_grading" && toGrade > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] tabular-nums transition-colors",
                  active ? "bg-white/25" : "bg-primary/15 text-primary",
                )}
              >
                {toGrade}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function PillButton({
  icon: Icon,
  onClick,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-xs font-semibold text-muted-foreground backdrop-blur-md transition-all hover:-translate-y-px hover:text-foreground hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 active:scale-95"
    >
      <Icon className="size-3.5" />
      <span className="hidden sm:inline">{children}</span>
      <span className="sr-only sm:hidden">{children}</span>
    </button>
  );
}

/* ================================================================== */
/* Question navigator                                                  */
/* ================================================================== */

function QuestionRail({
  result,
  stats,
  activeQ,
  isDirty,
  onJump,
  ready,
  completing,
  onComplete,
}: {
  result: SerializedResult;
  stats: { total: number; graded: number; percent: number };
  activeQ: string | null;
  isDirty: (q: Question) => boolean;
  onJump: (q: Question) => void;
  ready: boolean;
  completing: boolean;
  onComplete: () => void;
}) {
  const finalShown = useCountUp(result.finalScore, 700);
  const completed = result.evaluationStatus === "completed";

  const chipTone: Record<Tone, string> = {
    pending:
      "bg-primary/15 text-primary motion-safe:animate-[aad-breathe_2.4s_ease-in-out_infinite]",
    good: "bg-success-soft text-success",
    bad: "bg-danger-soft text-danger",
  };

  return (
    <aside
      aria-label="Question navigator"
      className={cn(
        GLASS,
        "sticky top-2 z-20 rounded-2xl p-2.5 lg:top-4 lg:self-start lg:p-4",
      )}
    >
      <div className="mb-4 hidden lg:block">
        <p className="text-xs text-muted-foreground">Live score</p>
        <p className="font-display text-3xl font-bold tracking-tight tabular-nums">
          {fmt(finalShown)}
          <span className="text-sm font-semibold text-muted-foreground">
            {" "}
            / {result.totalMarks}
          </span>
        </p>
        {stats.total > 0 && <Meter value={stats.percent} className="mt-2.5" />}
      </div>

      <p className="mb-2 hidden text-xs font-semibold text-muted-foreground lg:block">
        Questions
      </p>
      <div className="-m-1 flex gap-1.5 overflow-x-auto p-1 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {result.questions.map((q, i) => {
          const tone = toneOf(q);
          const dirty = isDirty(q);
          const active = activeQ === q.questionId;
          return (
            <button
              key={q.questionId}
              type="button"
              onClick={() => onJump(q)}
              aria-current={active ? "true" : undefined}
              aria-label={`Go to question ${i + 1}, ${labelForEval(q.evalStatus, q.awardedPoints)}${dirty ? ", unsaved changes" : ""}`}
              className={cn(
                "group/chip relative grid size-9 shrink-0 place-items-center rounded-xl text-xs font-bold tabular-nums",
                "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-90",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                chipTone[tone],
                active &&
                  "scale-110 outline outline-2 outline-offset-2 outline-primary",
              )}
            >
              {i + 1}
              {dirty && (
                <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-background bg-amber-500" />
              )}
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1 text-[11px] font-medium text-background opacity-0 shadow-lg transition-opacity duration-150 group-hover/chip:opacity-100 group-focus-visible/chip:opacity-100 lg:block"
              >
                Q{i + 1} · {displayType(q.type)} ·{" "}
                {labelForEval(q.evalStatus, q.awardedPoints)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 hidden flex-wrap gap-x-3 gap-y-1.5 text-[11px] text-muted-foreground lg:flex">
        <Legend className="bg-primary/70" label="To grade" />
        <Legend className="bg-success" label="Graded" />
        <Legend className="bg-danger" label="Incorrect" />
        <Legend className="bg-amber-500" label="Unsaved" />
      </div>

      <div className="mt-5 hidden lg:block">
        <CompleteButton
          ready={ready}
          completed={completed}
          completing={completing}
          onClick={onComplete}
        />
      </div>
    </aside>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}

/* ================================================================== */
/* Question card                                                       */
/* ================================================================== */

function Collapse({
  open,
  id,
  children,
}: {
  open: boolean;
  id?: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      style={{
        display: "grid",
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 350ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <div
        className="min-h-0 overflow-hidden"
        style={{
          visibility: open ? "visible" : "hidden",
          transition: `visibility 0s linear ${open ? "0s" : "350ms"}`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function QuestionCard({
  q,
  index,
  open,
  active,
  onToggle,
  grade,
  ai,
}: {
  q: Question;
  index: number;
  open: boolean;
  active: boolean;
  onToggle: () => void;
  grade: GradeProps;
  ai?: AiProps;
}) {
  const tone = toneOf(q);
  const t = TONE[tone];
  const Icon = typeIcon(q.type);
  const bodyId = `q-body-${q.questionId}`;
  const pending = q.evalStatus === "pending_evaluation";
  const ratio =
    q.points > 0 && !pending
      ? clamp((q.awardedPoints / q.points) * 100) / 100
      : 0;

  return (
    <article
      id={`q-${q.questionId}`}
      className={cn(GLASS_CARD, active && "border-primary/40")}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b",
          t.bar,
        )}
      />

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="group/hdr flex w-full items-center gap-4 p-4 pl-6 text-left transition-colors hover:bg-foreground/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 md:p-5 md:pl-7"
      >
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-2xl transition-all duration-300 group-hover/hdr:scale-105",
            t.tile,
            open && "shadow-lg",
          )}
        >
          <Icon className="size-5" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-display text-base font-semibold tracking-tight">
              Question {index + 1}
            </span>
            <span className="rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {displayType(q.type)}
            </span>
            {grade.dirty && <UnsavedPill />}
          </span>
          <span
            className={cn(
              "block text-sm text-muted-foreground transition-all duration-300",
              open ? "max-h-0 opacity-0" : "mt-0.5 max-h-6 truncate opacity-100",
            )}
          >
            {q.prompt}
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden text-right sm:block">
            <span className={cn("block text-xs font-semibold", t.text)}>
              {labelForEval(q.evalStatus, q.awardedPoints)}
            </span>
            <span className="block text-[11px] tabular-nums text-muted-foreground">
              of {q.points} marks
            </span>
          </span>
          <MiniGauge value={ratio} tone={tone}>
            {pending ? "—" : fmt(q.awardedPoints)}
          </MiniGauge>
        </span>

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-300",
            open && "rotate-180",
          )}
        />
      </button>

      <Collapse id={bodyId} open={open}>
        <div className="space-y-5 border-t border-border/50 px-4 pb-5 pl-6 pt-5 md:px-5 md:pl-7">
          <p className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">
            {q.prompt}
          </p>

          {q.type === "mcq" && <McqBody q={q} />}
          {q.type === "coding" && <CodingBody q={q} grade={grade} />}
          {q.type !== "mcq" && q.type !== "coding" && (
            <SubjectiveBody q={q} grade={grade} ai={ai} />
          )}
        </div>
      </Collapse>
    </article>
  );
}

function UnsavedPill() {
  return (
    <span className="inline-flex animate-[aad-pop_.3s_ease-out_backwards] items-center gap-1.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
      <span className="relative flex size-1.5">
        <span className="absolute inline-flex size-full rounded-full bg-amber-500 opacity-70 motion-safe:animate-ping" />
        <span className="relative inline-flex size-1.5 rounded-full bg-amber-500" />
      </span>
      Unsaved
    </span>
  );
}

function MiniGauge({
  value,
  tone,
  children,
}: {
  value: number;
  tone: Tone;
  children: ReactNode;
}) {
  const mounted = useMounted(100);
  const r = 18;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - (mounted ? clamp(value * 100) / 100 : 0));
  return (
    <span className="relative grid size-12 shrink-0 place-items-center">
      <svg viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90">
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          className="stroke-muted/80"
        />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            TONE[tone].stroke,
          )}
        />
      </svg>
      <span className="relative text-xs font-bold tabular-nums">{children}</span>
    </span>
  );
}

/* ---------- MCQ ---------- */

function McqBody({ q }: { q: Question }) {
  const correct = q.evalStatus === "correct";
  return (
    <div className="flex flex-wrap items-stretch gap-3">
      <OptionTile
        label="Student chose"
        value={q.selectedOptionKey || "—"}
        good={correct}
      />
      {!correct && (
        <OptionTile
          label="Correct answer"
          value={q.correctOptionKey || "—"}
          good
        />
      )}
      <div className="ml-auto flex items-center gap-2 rounded-2xl border border-border/50 bg-background/40 px-4 py-3 text-sm backdrop-blur-md">
        <span className="text-muted-foreground">Auto marks</span>
        <strong className="font-display text-lg tabular-nums">
          {q.awardedPoints}
          <span className="text-sm text-muted-foreground">/{q.points}</span>
        </strong>
      </div>
    </div>
  );
}

function OptionTile({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div
      className={cn(
        "flex animate-[aad-pop_.4s_cubic-bezier(.2,.8,.2,1)_backwards] items-center gap-3 rounded-2xl p-3 pr-4 backdrop-blur-md",
        good ? TONE.good.chip : TONE.bad.chip,
      )}
    >
      <span className="grid size-11 place-items-center rounded-xl bg-background/70 font-display text-xl font-bold shadow-sm">
        {value}
      </span>
      <span>
        <span className="block text-xs opacity-80">{label}</span>
        <span className="mt-0.5 flex items-center gap-1 text-sm font-semibold">
          {good ? <Check className="size-4" /> : <X className="size-4" />}
          {good ? "Correct" : "Incorrect"}
        </span>
      </span>
    </div>
  );
}

/* ---------- Coding ---------- */

function CodingBody({ q, grade }: { q: Question; grade: GradeProps }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Chip icon={Code2}>{q.selectedOptionKey || "—"}</Chip>
        {q.gradedAt && (
          <span
            suppressHydrationWarning
            className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur-md"
          >
            Graded {new Date(q.gradedAt).toLocaleString()}
          </span>
        )}
        {q.feedback?.trim() && (
          <span className="rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium backdrop-blur-md">
            {q.feedback}
          </span>
        )}
      </div>

      <TestSegments passed={q.passedTests} total={q.totalTests} />

      <CodeBlock
        code={q.textAnswer.trim()}
        language={q.selectedOptionKey || "code"}
      />

      <GradeEditor
        q={q}
        grade={grade}
        title="Override score"
        feedbackPlaceholder="Optional override note"
        saveLabel="Override grade"
      />
    </div>
  );
}

function TestSegments({ passed, total }: { passed: number; total: number }) {
  const mounted = useMounted(150);
  const allPassed = total > 0 && passed === total;
  const segments = total > 0 && total <= 24 ? total : 0;

  return (
    <div className="rounded-2xl border border-border/50 bg-background/40 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">Test cases passed</span>
        <span
          className={cn(
            "font-display text-lg font-bold tabular-nums",
            allPassed ? "text-success" : "text-foreground",
          )}
        >
          {passed}
          <span className="text-sm font-semibold text-muted-foreground">
            /{total}
          </span>
        </span>
      </div>
      {segments > 0 ? (
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: segments }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-2.5 flex-1 rounded-full transition-all duration-300",
                mounted && i < passed
                  ? "bg-success shadow-[0_0_10px_-2px] shadow-success/60"
                  : "bg-muted/70",
              )}
              style={{ transitionDelay: `${i * 45}ms` }}
            />
          ))}
        </div>
      ) : (
        <Meter
          value={total > 0 ? (passed / total) * 100 : 0}
          barClassName={allPassed ? "from-success to-success/70" : undefined}
        />
      )}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      /* clipboard unavailable: ignore */
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-950/90 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-3">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-rose-400/80" />
            <span className="size-2.5 rounded-full bg-amber-300/80" />
            <span className="size-2.5 rounded-full bg-emerald-400/80" />
          </span>
          <span className="font-mono text-xs text-slate-400">{language}</span>
        </div>
        {code && (
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-slate-400 transition-all hover:bg-white/10 hover:text-slate-100 active:scale-95"
          >
            {copied ? (
              <span className="inline-flex animate-[aad-swap_.25s_ease-out_backwards] items-center gap-1.5 text-emerald-400">
                <Check className="size-3.5" />
                Copied
              </span>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy
              </>
            )}
          </button>
        )}
      </div>
      <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-slate-100">
        {code || "No code submitted."}
      </pre>
    </div>
  );
}

/* ---------- Subjective ---------- */

function SubjectiveBody({
  q,
  grade,
  ai,
}: {
  q: Question;
  grade: GradeProps;
  ai?: AiProps;
}) {
  const text = q.textAnswer.trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  const loading = ai?.loading ?? false;
  const step = useAiStep(loading);

  return (
    <div className="space-y-5">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-background/40 backdrop-blur-md transition-all duration-500",
          loading
            ? "border-violet-400/50 shadow-[0_0_44px_-12px_rgb(var(--aad-ai-1)/0.5)]"
            : "border-border/50",
        )}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/80">
            Student answer
          </span>
          {loading ? <AiStepper step={step} /> : (
            <span className="tabular-nums">
              {words} {words === 1 ? "word" : "words"} · {text.length}{" "}
              characters
            </span>
          )}
        </div>

        <pre
          className={cn(
            "max-h-80 overflow-auto whitespace-pre-wrap p-4 font-sans text-sm leading-relaxed transition-opacity duration-500 md:p-5",
            !text && "italic text-muted-foreground",
            loading && "opacity-80",
          )}
        >
          {text || "No answer submitted."}
        </pre>

        {/* The scan beam: shows the AI "reading" the answer */}
        {loading && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[41px] overflow-hidden"
          >
            <div className="h-1/3 w-full animate-[aad-scan_2s_cubic-bezier(.45,.05,.55,.95)_infinite] border-b-2 border-sky-400/80 bg-gradient-to-b from-transparent via-violet-500/10 to-sky-400/30 shadow-[0_8px_24px_-6px_rgb(var(--aad-ai-2)/0.5)]" />
          </div>
        )}
      </div>

      <GradeEditor
        q={q}
        grade={grade}
        ai={ai}
        title="Grade this answer"
        feedbackPlaceholder="Optional feedback for the student"
        saveLabel="Save grade"
      />
    </div>
  );
}

function AiStepper({ step }: { step: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex animate-[aad-pop_.3s_ease-out_backwards] items-center gap-2.5 text-[11px] font-semibold text-violet-600 dark:text-violet-300"
    >
      <span className="flex gap-1">
        {AI_STEPS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-6 rounded-full transition-all duration-500",
              i < step
                ? "bg-violet-500"
                : i === step
                  ? "bg-gradient-to-r from-violet-500 to-sky-400 motion-safe:animate-pulse"
                  : "bg-muted",
            )}
          />
        ))}
      </span>
      Step {step + 1} of {AI_STEPS.length}
    </span>
  );
}

/* ================================================================== */
/* Grade editor                                                        */
/* ================================================================== */

function Aurora({ active }: { active: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "aad-aurora transition-opacity duration-700",
        active ? "opacity-100" : "opacity-0",
      )}
      style={{ animationPlayState: active ? "running" : "paused" }}
    />
  );
}

function GradeEditor({
  q,
  grade,
  ai,
  title,
  feedbackPlaceholder,
  saveLabel,
}: {
  q: Question;
  grade: GradeProps;
  ai?: AiProps;
  title: string;
  feedbackPlaceholder: string;
  saveLabel: string;
}) {
  const { draft, dirty, marksValid, saving, saved, error, onChange, onSave } =
    grade;
  const loading = ai?.loading ?? false;
  const flash = ai?.flash ?? false;
  const canSave = dirty && marksValid && !saving && !loading;
  const marksNum = marksValid ? Number(draft.marks) : 0;
  const fill = q.points > 0 ? (marksNum / q.points) * 100 : 0;

  const nudge = (delta: number) => {
    const base = marksValid ? marksNum : 0;
    const next = clamp(Math.round((base + delta) * 2) / 2, 0, q.points);
    onChange({ marks: String(next) });
  };

  const quick = [
    { label: "0", value: 0 },
    { label: "Half", value: q.points / 2 },
    { label: "Full", value: q.points },
  ];

  const saveState = saving ? "saving" : saved ? "saved" : "idle";

  return (
    <div
      className={cn(
        "relative space-y-5 rounded-2xl border bg-background/50 p-4 backdrop-blur-md transition-all duration-700 md:p-5",
        loading
          ? "border-transparent shadow-[0_0_44px_-10px_rgb(var(--aad-ai-1)/0.55)]"
          : flash
            ? "border-violet-400/50 bg-violet-500/5"
            : "border-border/50",
      )}
    >
      <Aurora active={loading} />

      {/* Title + live marks readout */}
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-display text-sm font-semibold tracking-tight">
          {title}
        </h4>
        <span
          className={cn(
            "rounded-xl px-3 py-1.5 font-display text-xl font-bold tabular-nums transition-all duration-500",
            marksValid ? "bg-muted/70" : "bg-danger-soft text-danger",
            flash && "scale-110 bg-violet-500/15 text-violet-600 dark:text-violet-300",
          )}
        >
          {marksValid ? fmt(marksNum) : "—"}
          <span className="text-xs font-semibold text-muted-foreground">
            {" "}
            / {q.points}
          </span>
        </span>
      </div>

      <div
        aria-busy={loading}
        className={cn(
          "space-y-5 transition-all duration-500",
          loading && "pointer-events-none opacity-50 blur-[0.5px]",
        )}
      >
        {/* Marks */}
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div>
            <label
              htmlFor={`range-${q.questionId}`}
              className="text-xs font-semibold text-muted-foreground"
            >
              Marks (0–{q.points})
            </label>
            <input
              id={`range-${q.questionId}`}
              type="range"
              min={0}
              max={q.points}
              step={0.5}
              value={marksNum}
              onChange={(e) => onChange({ marks: e.target.value })}
              style={{ "--aad-fill": `${fill}%` } as CSSProperties}
              className="aad-range mt-3 block w-full text-primary"
            />
            <div className="mt-2 flex justify-between text-[10px] tabular-nums text-muted-foreground">
              <span>0</span>
              <span>{fmt(q.points / 2)}</span>
              <span>{fmt(q.points)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {quick.map((c) => {
                const on = marksValid && marksNum === c.value;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => onChange({ marks: String(c.value) })}
                    aria-pressed={on}
                    className={cn(
                      "rounded-full border px-3.5 py-1 text-xs font-semibold transition-all active:scale-90",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                      on
                        ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/30"
                        : "border-border/60 bg-background/50 text-muted-foreground hover:-translate-y-px hover:text-foreground hover:shadow-sm",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor={`marks-${q.questionId}`}
              className="text-xs font-semibold text-muted-foreground"
            >
              Exact marks
            </label>
            <div
              className={cn(
                "mt-1.5 inline-flex items-center rounded-xl border bg-background/60 p-1 backdrop-blur-md transition-colors",
                marksValid ? "border-border/60" : "border-danger",
              )}
            >
              <button
                type="button"
                aria-label="Decrease marks by 0.5"
                disabled={marksValid && marksNum <= 0}
                onClick={() => nudge(-0.5)}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 disabled:opacity-40"
              >
                <Minus className="size-4" />
              </button>
              <Input
                id={`marks-${q.questionId}`}
                type="number"
                min={0}
                max={q.points}
                step={0.5}
                aria-invalid={!marksValid}
                value={draft.marks}
                onChange={(e) => onChange({ marks: e.target.value })}
                className="h-8 w-16 border-0 bg-transparent px-1 text-center font-display text-base font-bold tabular-nums shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="Increase marks by 0.5"
                disabled={marksValid && marksNum >= q.points}
                onClick={() => nudge(0.5)}
                className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-90 disabled:opacity-40"
              >
                <Plus className="size-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Feedback */}
        <div>
          <label
            htmlFor={`feedback-${q.questionId}`}
            className="text-xs font-semibold text-muted-foreground"
          >
            Feedback
          </label>
          <div className="relative mt-1.5">
            <textarea
              id={`feedback-${q.questionId}`}
              rows={3}
              value={draft.feedback}
              placeholder={feedbackPlaceholder}
              onChange={(e) => onChange({ feedback: e.target.value })}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && canSave) {
                  e.preventDefault();
                  onSave();
                }
              }}
              className={cn(
                "w-full resize-y rounded-xl border border-border/60 bg-background/60 px-3.5 pb-7 pt-3 text-sm leading-relaxed backdrop-blur-md",
                "placeholder:text-muted-foreground transition-all duration-500",
                "focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10",
                flash && "border-violet-400/60 ring-4 ring-violet-400/15",
              )}
            />
            <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] tabular-nums text-muted-foreground">
              {draft.feedback.length} characters
            </span>
          </div>
        </div>
      </div>

      {!marksValid && (
        <p className="animate-[aad-pop_.3s_ease-out_backwards] text-xs font-semibold text-danger">
          Enter marks between 0 and {q.points}.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {ai && (
          <AiSuggestButton
            loading={ai.loading}
            disabled={ai.busyElsewhere || saving}
            onClick={ai.onSuggest}
          />
        )}
        <div className="ml-auto flex items-center gap-3">
          {dirty && marksValid && !saving && (
            <span className="hidden animate-[aad-pop_.3s_ease-out_backwards] items-center gap-1.5 text-xs text-muted-foreground sm:inline-flex">
              Unsaved
              <kbd className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold">
                Ctrl
              </kbd>
              <kbd className="rounded-md border border-border/60 bg-background/60 px-1.5 py-0.5 text-[10px] font-semibold">
                ↵
              </kbd>
            </span>
          )}
          <Button
            size="sm"
            disabled={!canSave}
            onClick={onSave}
            className="group relative h-10 min-w-[132px] overflow-hidden rounded-xl bg-gradient-to-b from-primary to-primary/85 px-5 font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/35 active:translate-y-0 active:scale-95 disabled:shadow-none"
          >
            <ShineSweep />
            <span
              key={saveState}
              className="relative flex animate-[aad-swap_.3s_ease-out_backwards] items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 motion-safe:animate-spin" />
                  Saving…
                </>
              ) : saved ? (
                <>
                  <Check className="size-4" />
                  Saved
                </>
              ) : (
                saveLabel
              )}
            </span>
          </Button>
        </div>
      </div>

      {ai && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          AI sends the student answer to a third-party provider and only
          suggests. Nothing is saved until you save the grade.
        </p>
      )}

      {ai?.suggestion && (
        <SuggestionCard
          key={`${ai.suggestion.marks}-${ai.suggestion.feedback}`}
          suggestion={ai.suggestion}
          max={q.points}
          onUndo={ai.onUndo}
          onDismiss={ai.onDismiss}
        />
      )}

      {error && (
        <div
          role="alert"
          className="animate-[aad-pop_.3s_ease-out_backwards] rounded-xl bg-danger-soft px-3.5 py-2.5 text-sm font-semibold text-danger"
        >
          {error}
        </div>
      )}
    </div>
  );
}

/* ---------- AI suggestion card ---------- */

function SuggestionCard({
  suggestion,
  max,
  onUndo,
  onDismiss,
}: {
  suggestion: Suggestion;
  max: number;
  onUndo: () => void;
  onDismiss: () => void;
}) {
  const target = Number(suggestion.marks) || 0;
  const typed = useTypewriter(suggestion.feedback);
  const typing = typed.length < suggestion.feedback.length;

  return (
    <div
      role="status"
      className="relative animate-[aad-pop_.5s_cubic-bezier(.2,.8,.2,1)_backwards] overflow-hidden rounded-2xl border border-violet-400/30 bg-gradient-to-br from-violet-500/10 via-background/40 to-sky-500/10 p-4 backdrop-blur-xl md:p-5"
    >
      <Aurora active={typing} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-4 text-violet-500 motion-safe:animate-[aad-sparkle_1.8s_ease-in-out_infinite]" />
          <span className="bg-gradient-to-r from-violet-600 via-sky-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-violet-300 dark:via-sky-300 dark:to-fuchsia-300">
            AI suggestion
          </span>
          <span className="rounded-full border border-border/60 bg-background/70 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Draft · not saved
          </span>
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-lg px-2.5 text-xs"
            onClick={onUndo}
          >
            <Undo2 className="size-3.5" />
            Undo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 rounded-lg px-2.5 text-xs"
            onClick={onDismiss}
          >
            Keep and edit
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <AiDial target={target} max={max} />

        {suggestion.feedback ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {typed}
            {typing && (
              <span
                aria-hidden
                className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-[aad-caret_1s_step-end_infinite] bg-violet-500"
              />
            )}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No written feedback was suggested.
          </p>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Marks and feedback are filled in above. Review, edit if needed, then
        save.
      </p>
    </div>
  );
}

function AiDial({ target, max }: { target: number; max: number }) {
  const mounted = useMounted(80);
  const shown = useCountUp(target, 900, 0);
  const gid = useId().replace(/:/g, "");
  const r = 40;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? clamp((target / max) * 100) / 100 : 0;
  const offset = c * (1 - (mounted ? pct : 0));

  return (
    <div className="relative mx-auto size-28 shrink-0 md:mx-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90 overflow-visible">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: "rgb(var(--aad-ai-1))" }} />
            <stop offset="55%" style={{ stopColor: "rgb(var(--aad-ai-2))" }} />
            <stop offset="100%" style={{ stopColor: "rgb(var(--aad-ai-3))" }} />
          </linearGradient>
        </defs>
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          className="stroke-muted/80"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke={`url(#${gid})`}
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="opacity-50 blur-[5px] transition-[stroke-dashoffset] duration-1000 ease-out"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          strokeWidth="9"
          strokeLinecap="round"
          stroke={`url(#${gid})`}
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="font-display text-3xl font-bold leading-none tracking-tight tabular-nums">
            {fmt(shown)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            of {fmt(max)}
          </p>
        </div>
      </div>
      <Burst />
    </div>
  );
}

/** One-shot sparkle burst when a new suggestion lands. */
function Burst() {
  const dots = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { i, dx: Math.cos(a) * 64, dy: Math.sin(a) * 64 };
  });
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0">
      {dots.map((d) => (
        <span
          key={d.i}
          className={cn(
            "absolute left-1/2 top-1/2 -ml-[3px] -mt-[3px] size-1.5 rounded-full opacity-0 animate-[aad-burst_.9s_cubic-bezier(.2,.8,.2,1)_forwards]",
            d.i % 3 === 0
              ? "bg-violet-400"
              : d.i % 3 === 1
                ? "bg-sky-400"
                : "bg-fuchsia-400",
          )}
          style={
            {
              "--dx": `${d.dx}px`,
              "--dy": `${d.dy}px`,
              animationDelay: `${150 + (d.i % 3) * 40}ms`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  );
}

/* ---------- AI button ---------- */

function AiSuggestButton({
  loading,
  disabled,
  onClick,
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const step = useAiStep(loading);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={loading}
      onClick={() => {
        if (!loading) onClick();
      }}
      className={cn(
        "group relative isolate inline-flex h-10 items-center gap-2 overflow-hidden rounded-full border border-border/60 bg-background/70 px-4 text-sm font-semibold shadow-sm backdrop-blur-md transition-all duration-300",
        "hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60",
        "disabled:pointer-events-none disabled:opacity-50",
        loading && "border-transparent shadow-[0_0_28px_-6px_rgb(var(--aad-ai-1)/0.55)]",
      )}
    >
      <Aurora active={loading} />
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 -z-10 animate-[aad-shimmer_1.8s_linear_infinite] bg-gradient-to-r from-violet-500/0 via-violet-500/15 to-sky-400/0 bg-[length:200%_100%] transition-opacity duration-300",
          loading ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      />
      {loading ? (
        <Loader2 className="size-4 text-violet-500 motion-safe:animate-spin" />
      ) : (
        <Sparkles className="size-4 text-violet-500 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-125" />
      )}
      <span
        key={loading ? step : "idle"}
        aria-live="polite"
        className="animate-[aad-swap_.35s_ease-out_backwards] bg-gradient-to-r from-violet-600 via-sky-600 to-fuchsia-600 bg-clip-text text-transparent dark:from-violet-300 dark:via-sky-300 dark:to-fuchsia-300"
      >
        {loading ? AI_STEPS[step] : "Suggest with AI"}
      </span>
    </button>
  );
}

/* ================================================================== */
/* Toast                                                               */
/* ================================================================== */

function Toast({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-50 w-[min(24rem,calc(100vw-2rem))]"
    >
      {notice && (
        <div
          key={notice.id}
          role="status"
          className={cn(
            "pointer-events-auto relative flex animate-[aad-toast-in_.45s_cubic-bezier(.2,.8,.2,1)_backwards] items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3.5 text-sm font-semibold shadow-2xl backdrop-blur-xl",
            notice.kind === "success"
              ? "border-success/30 bg-success-soft/90 text-success"
              : "border-danger/30 bg-danger-soft/90 text-danger",
          )}
        >
          <span
            className={cn(
              "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-white",
              notice.kind === "success" ? "bg-success" : "bg-danger",
            )}
          >
            {notice.kind === "success" ? (
              <Check className="size-3" />
            ) : (
              <X className="size-3" />
            )}
          </span>
          <span className="flex-1">{notice.text}</span>
          <button
            type="button"
            aria-label="Dismiss"
            className="opacity-60 transition-opacity hover:opacity-100"
            onClick={onClose}
          >
            <X className="size-4" />
          </button>
          <span
            aria-hidden
            className={cn(
              "absolute bottom-0 left-0 h-0.5 animate-[aad-toast-bar_4.5s_linear_forwards]",
              notice.kind === "success" ? "bg-success" : "bg-danger",
            )}
          />
        </div>
      )}
    </div>
  );
}

/* ================================================================== */

function labelForEval(status: string, awarded: number) {
  if (status === "correct") return `Correct (+${awarded})`;
  if (status === "incorrect") return "Incorrect";
  if (status === "pending_evaluation") return "Needs grading";
  if (status === "manually_graded") return `Graded (+${awarded})`;
  if (status === "auto_graded") return `Auto graded (+${awarded})`;
  return status;
}