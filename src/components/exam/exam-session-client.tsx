"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
} from "lucide-react";
import {
  saveAnswerAction,
  submitExamAction,
} from "@/lib/actions/exam";
import { ExamCodingPanel } from "@/components/exam/exam-coding-panel";
import { ExamSecurityBanner } from "@/components/exam/exam-security-banner";
import { useExamRecording } from "@/hooks/use-exam-recording";
import { useExamSecurity } from "@/hooks/use-exam-security";
import { useFaceDetection } from "@/hooks/use-face-detection";
import { useHeadPoseMonitoring } from "@/hooks/use-head-pose-monitoring";
import type {
  SerializedAnswer,
  SerializedAttempt,
  SerializedExamQuestion,
} from "@/lib/serializers";
import { displayType } from "@/lib/serializers";
import {
  DEFAULT_ASSESSMENT_SECURITY,
  normalizeAssessmentSecurity,
  type AssessmentSecuritySettings,
} from "@/types/assessment-security";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

type AnswerMap = Record<
  string,
  { selectedOptionKey: string; textAnswer: string }
>;

function buildAnswerMap(answers: SerializedAnswer[]): AnswerMap {
  const map: AnswerMap = {};
  for (const a of answers) {
    map[a.questionId] = {
      selectedOptionKey: a.selectedOptionKey,
      textAnswer: a.textAnswer,
    };
  }
  return map;
}

function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function ExamSessionClient({
  attempt: initialAttempt,
  questions,
  answers: initialAnswers,
  serverNow,
  security: securityProp,
}: {
  attempt: SerializedAttempt;
  questions: SerializedExamQuestion[];
  answers: SerializedAnswer[];
  serverNow: string;
  security?: AssessmentSecuritySettings;
}) {
  const router = useRouter();
  const security = normalizeAssessmentSecurity(
    securityProp ?? DEFAULT_ASSESSMENT_SECURITY,
  );
  const [attempt, setAttempt] = useState(initialAttempt);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState(() => buildAnswerMap(initialAnswers));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitPhase, setSubmitPhase] = useState("");
  const [pending, startTransition] = useTransition();
  const [remainingMs, setRemainingMs] = useState(() => {
    const skew = Date.now() - new Date(serverNow).getTime();
    return new Date(initialAttempt.expiresAt).getTime() - (Date.now() - skew);
  });
  const skewRef = useRef(Date.now() - new Date(serverNow).getTime());
  const autoSubmitted = useRef(false);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [securityEnabled, setSecurityEnabled] = useState(true);
  const [cameraDeviceId] = useState(() => {
    try {
      return sessionStorage.getItem("codeshield-exam-camera-device") || "";
    } catch {
      return "";
    }
  });

  const {
    warning,
    fullscreenActive,
    fullscreenMessage,
    enterFullscreen,
    exitFullscreenAfterSubmit,
    dismissWarning,
  } = useExamSecurity({
    attemptId: attempt.id,
    enabled: securityEnabled && attempt.status === "in_progress",
    settings: security,
  });

  const {
    videoRef,
    cameraActive,
    cameraWarning,
    recordingStatus,
    reconnect,
    finalizeAfterSubmit,
  } = useExamRecording({
    attemptId: attempt.id,
    enabled:
      security.requireCamera &&
      securityEnabled &&
      attempt.status === "in_progress",
    deviceId: cameraDeviceId,
  });

  const {
    status: faceStatus,
    faceCount,
    isDetecting: faceDetecting,
    warning: faceWarning,
    error: faceError,
  } = useFaceDetection({
    attemptId: attempt.id,
    enabled:
      security.requireFaceDetection &&
      securityEnabled &&
      attempt.status === "in_progress",
    videoRef,
    cameraActive,
  });

  const faceReady =
    faceStatus === "detected" && faceCount === 1 && cameraActive;

  const {
    status: headStatus,
    orientation: headOrientation,
    isMonitoring: headMonitoring,
    warning: headWarning,
    error: headError,
  } = useHeadPoseMonitoring({
    attemptId: attempt.id,
    enabled:
      security.requireHeadMonitoring &&
      securityEnabled &&
      attempt.status === "in_progress",
    videoRef,
    cameraActive,
    faceReady,
  });

  const current = questions[index];
  const answeredCount = useMemo(
    () =>
      questions.filter((q) => {
        const a = answers[q.id];
        if (!a) return false;
        if (q.type === "mcq") return Boolean(a.selectedOptionKey);
        return Boolean(a.textAnswer.trim());
      }).length,
    [answers, questions],
  );

  const persist = (questionId: string, next: AnswerMap[string]) => {
    if (saveTimers.current[questionId]) {
      clearTimeout(saveTimers.current[questionId]);
    }
    setSaveState("saving");
    saveTimers.current[questionId] = setTimeout(() => {
      startTransition(async () => {
        const result = await saveAnswerAction({
          attemptId: attempt.id,
          questionId,
          selectedOptionKey: next.selectedOptionKey,
          textAnswer: next.textAnswer,
        });
        if ("error" in result && result.error) {
          setSaveState("error");
          setError(result.error);
          if (
            result.error.includes("closed") ||
            result.error.includes("expired")
          ) {
            router.replace(`/student/exam/result/${attempt.id}`);
          }
          return;
        }
        if ("attempt" in result && result.attempt) {
          setAttempt(result.attempt);
        }
        if ("serverNow" in result && result.serverNow) {
          skewRef.current = Date.now() - new Date(result.serverNow).getTime();
        }
        setSaveState("saved");
        setError("");
      });
    }, 400);
  };

  const updateAnswer = (patch: Partial<AnswerMap[string]>) => {
    if (!current) return;
    const prev = answers[current.id] ?? {
      selectedOptionKey: "",
      textAnswer: "",
    };
    const next = { ...prev, ...patch };
    setAnswers((map) => ({ ...map, [current.id]: next }));
    persist(current.id, next);
  };

  const submit = (forced = false) => {
    if (autoSubmitted.current) return;
    autoSubmitted.current = true;
    setSecurityEnabled(false);
    setSubmitPhase("Submitting exam…");
    startTransition(async () => {
      const result = await submitExamAction(attempt.id);
      if ("error" in result && result.error) {
        setError(result.error);
        autoSubmitted.current = false;
        setSecurityEnabled(true);
        setSubmitPhase("");
        return;
      }
      // Exit fullscreen only after successful final submit (not autosave).
      await exitFullscreenAfterSubmit();

      if (security.requireCamera) {
        setSubmitPhase("Finalizing camera recording…");
        await finalizeAfterSubmit();
      }

      setSubmitPhase("");
      router.replace(`/student/exam/result/${attempt.id}`);
    });
    if (!forced) setConfirmOpen(false);
  };

  useEffect(() => {
    const tick = () => {
      const ms =
        new Date(attempt.expiresAt).getTime() - (Date.now() - skewRef.current);
      setRemainingMs(ms);
      if (ms <= 0 && !autoSubmitted.current) {
        submit(true);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt.expiresAt, attempt.id]);

  useEffect(() => {
    return () => {
      Object.values(saveTimers.current).forEach(clearTimeout);
    };
  }, []);

  if (!current) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-soft p-8 text-center">
          <p className="text-muted-foreground">No questions in this exam.</p>
          <Button className="mt-4" onClick={() => submit(true)}>
            Submit attempt
          </Button>
        </div>
      </div>
    );
  }

  const urgent = remainingMs <= 60_000;

  return (
    <div className="min-h-screen bg-background relative">
      <div className="absolute inset-0 grid-bg opacity-40 pointer-events-none" />
      <div className="relative border-b border-border bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">
              {attempt.assessmentTitle}
            </h1>
            <p className="text-[11px] text-muted-foreground">
              Question {index + 1} of {questions.length} · {answeredCount}{" "}
              answered ·{" "}
              {saveState === "saving"
                ? "Saving…"
                : saveState === "saved"
                  ? "Saved"
                  : saveState === "error"
                    ? "Save failed"
                    : "Ready"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border",
                urgent
                  ? "border-danger text-danger bg-danger/10"
                  : "border-border text-foreground bg-background",
              )}
            >
              <Clock className="w-4 h-4" />
              {formatRemaining(remainingMs)}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmOpen(true)}
              disabled={pending}
            >
              <Flag className="w-4 h-4" />
              Submit
            </Button>
          </div>
        </div>
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{
              width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%`,
            }}
          />
        </div>
      </div>

      <ExamSecurityBanner
        warning={warning}
        fullscreenActive={fullscreenActive}
        fullscreenMessage={fullscreenMessage}
        onEnterFullscreen={enterFullscreen}
        onDismiss={dismissWarning}
      />

      {security.requireCamera && (
        <div className="relative z-20 max-w-6xl mx-auto px-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-28 h-20 rounded-lg overflow-hidden border border-border bg-black shrink-0">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold">
                Camera:{" "}
                {cameraActive
                  ? "Active"
                  : recordingStatus === "failed"
                    ? "Unavailable"
                    : "Starting…"}
              </p>
              {security.requireFaceDetection && (
                <p className="font-semibold">
                  Face:{" "}
                  {faceStatus === "preparing"
                    ? "Preparing…"
                    : faceStatus === "unavailable"
                      ? "Monitoring unavailable"
                      : faceStatus === "paused"
                        ? "Paused"
                        : faceStatus === "not_detected"
                          ? "Not detected"
                          : faceStatus === "multiple"
                            ? "Multiple faces detected"
                            : faceDetecting
                              ? "Detected"
                              : "Starting…"}
                  {faceDetecting && faceCount > 0 ? ` (${faceCount})` : ""}
                </p>
              )}
              {security.requireFaceDetection && faceStatus === "preparing" && (
                <p className="text-muted-foreground">
                  Preparing camera monitoring…
                </p>
              )}
              {security.requireFaceDetection &&
                faceDetecting &&
                faceStatus === "detected" && (
                  <p className="text-success font-medium">
                    Camera monitoring active
                  </p>
                )}
              {security.requireHeadMonitoring && (
                <p className="font-semibold">
                  Monitoring:{" "}
                  {headStatus === "preparing"
                    ? "Preparing…"
                    : headStatus === "unavailable"
                      ? "Unavailable"
                      : headStatus === "paused"
                        ? "Paused"
                        : headStatus === "looking_away"
                          ? `Looking away${
                              headOrientation !== "NORMAL"
                                ? ` (${headOrientation.toLowerCase()})`
                                : ""
                            }`
                          : headMonitoring
                            ? "Active"
                            : "Starting…"}
                </p>
              )}
              {headWarning && (
                <p className="text-amber-800 font-medium max-w-md">{headWarning}</p>
              )}
              {headError && (
                <p className="text-muted-foreground font-medium max-w-md">
                  {headError}
                </p>
              )}
              {faceWarning && (
                <p className="text-amber-800 font-medium max-w-md">
                  {faceWarning}
                </p>
              )}
              {faceError && (
                <p className="text-muted-foreground font-medium max-w-md">
                  {faceError}
                </p>
              )}
              {cameraWarning && (
                <p className="text-danger font-medium mt-1 max-w-md">
                  {cameraWarning}{" "}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void reconnect()}
                  >
                    Reconnect
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {submitPhase && (
        <div className="relative z-30 max-w-6xl mx-auto px-4 pt-2">
          <p className="text-sm font-semibold text-primary bg-primary-soft px-3 py-2 rounded-lg">
            {submitPhase}
          </p>
        </div>
      )}

      <div className="relative max-w-6xl mx-auto p-4 md:p-6 grid lg:grid-cols-[220px_1fr] gap-4">
        <aside className="card-soft p-4 h-fit">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">
            Questions
          </p>
          <div className="grid grid-cols-5 lg:grid-cols-4 gap-2">
            {questions.map((q, i) => {
              const a = answers[q.id];
              const done =
                q.type === "mcq"
                  ? Boolean(a?.selectedOptionKey)
                  : Boolean(a?.textAnswer?.trim());
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "h-9 rounded-lg text-xs font-bold border transition",
                    i === index
                      ? "bg-primary text-primary-foreground border-primary"
                      : done
                        ? "bg-primary-soft text-primary border-primary/30"
                        : "bg-background text-muted-foreground border-border hover:border-primary",
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="card-soft p-5 md:p-7">
          <div className="flex items-center justify-between gap-3 mb-4">
            <span className="text-xs font-semibold px-2 py-1 rounded-lg bg-primary-soft text-primary">
              {displayType(current.type)} · {current.points} marks
            </span>
            <span className="text-xs text-muted-foreground">{current.code}</span>
          </div>

          <h2 className="font-display font-bold text-xl mb-5 whitespace-pre-wrap">
            {current.prompt}
          </h2>

          {current.type === "mcq" ? (
            <div className="space-y-2">
              {current.options.map((opt) => {
                const selected =
                  answers[current.id]?.selectedOptionKey === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() =>
                      updateAnswer({ selectedOptionKey: opt.key })
                    }
                    className={cn(
                      "w-full text-left rounded-xl border px-4 py-3 transition",
                      selected
                        ? "border-primary bg-primary-soft"
                        : "border-border hover:border-primary/50",
                    )}
                  >
                    <span className="font-semibold mr-2">{opt.key}.</span>
                    {opt.text}
                  </button>
                );
              })}
            </div>
          ) : current.type === "coding" ? (
            <ExamCodingPanel
              attemptId={attempt.id}
              question={current}
              initialLanguage={answers[current.id]?.selectedOptionKey ?? ""}
              initialSourceCode={answers[current.id]?.textAnswer ?? ""}
              onDraftChange={(patch) => {
                setAnswers((map) => ({ ...map, [current.id]: patch }));
              }}
              disabled={remainingMs <= 0}
            />
          ) : (
            <textarea
              className="w-full min-h-[220px] rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
              placeholder="Type your answer here…"
              value={answers[current.id]?.textAnswer ?? ""}
              onChange={(e) => updateAnswer({ textAnswer: e.target.value })}
            />
          )}

          {error && (
            <p className="mt-4 text-sm text-danger font-medium">{error}</p>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={index === 0}
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>
            {index < questions.length - 1 ? (
              <Button onClick={() => setIndex((i) => i + 1)}>
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button onClick={() => setConfirmOpen(true)} disabled={pending}>
                Review & Submit
              </Button>
            )}
          </div>
        </main>
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit exam?"
      >
        <p className="text-sm text-muted-foreground mb-4">
          You have answered {answeredCount} of {questions.length} questions.
          You cannot change answers after submission.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setConfirmOpen(false)}>
            Continue exam
          </Button>
          <Button onClick={() => submit(false)} disabled={pending}>
            {pending ? "Submitting…" : "Submit now"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
