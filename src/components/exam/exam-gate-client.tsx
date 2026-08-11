"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Mic, Wifi } from "lucide-react";
import { startExamAction } from "@/lib/actions/exam";
import { displayType, type SerializedAssessment } from "@/lib/serializers";
import { Button } from "@/components/ui/button";

export function ExamGateClient({
  assessment,
  activeAttemptId,
  latestResultAttemptId,
}: {
  assessment: SerializedAssessment;
  activeAttemptId?: string | null;
  latestResultAttemptId?: string | null;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const start = () => {
    setError("");
    startTransition(async () => {
      if (activeAttemptId) {
        router.push(`/student/exam/session/${activeAttemptId}`);
        return;
      }
      const result = await startExamAction(assessment.id);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("attempt" in result && result.attempt) {
        router.push(`/student/exam/session/${result.attempt.id}`);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative">
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
      <div className="relative card-soft p-8 max-w-lg w-full shadow-elevated">
        <h1 className="font-display font-bold text-2xl">{assessment.title}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {displayType(assessment.type)} · {assessment.durationMin} min ·{" "}
          {assessment.questionCount} questions
        </p>
        {assessment.description && (
          <p className="text-sm text-muted-foreground mt-3">
            {assessment.description}
          </p>
        )}

        <div className="mt-6">
          <h2 className="font-semibold mb-3">Secure exam environment</h2>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {(assessment.instructions
              ? assessment.instructions.split("\n").filter(Boolean)
              : [
                  "You will be monitored by AI proctoring (face, eye, behavior)",
                  "Tab switching, copy/paste, right-click and dev tools are disabled",
                  "Violations may auto-submit your exam",
                  "Stay in full-screen until you finish",
                ]
            ).map((line) => (
              <li key={line}>• {line.replace(/^•\s*/, "")}</li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: Camera, label: "Camera" },
            { icon: Mic, label: "Microphone" },
            { icon: Wifi, label: "Network" },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-border p-3 text-center"
            >
              <item.icon className="w-5 h-5 mx-auto text-primary" />
              <div className="text-[11px] font-semibold mt-2">{item.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <p className="mt-4 text-sm text-danger font-medium">{error}</p>
        )}

        <div className="mt-6 flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link href="/student/assessments">Cancel</Link>
          </Button>
          <Button className="flex-1" onClick={start} disabled={pending}>
            {pending
              ? "Starting…"
              : activeAttemptId
                ? "Resume Exam"
                : "I Agree · Start Exam"}
          </Button>
        </div>

        {latestResultAttemptId && !activeAttemptId && (
          <p className="text-center mt-3">
            <Link
              href={`/student/exam/result/${latestResultAttemptId}`}
              className="text-xs font-semibold text-primary"
            >
              View previous result
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
