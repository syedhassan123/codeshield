"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Mic, Wifi } from "lucide-react";
import { startExamAction } from "@/lib/actions/exam";
import { CameraPrecheck } from "@/components/exam/camera-precheck";
import { displayType, type SerializedAssessment } from "@/lib/serializers";
import { normalizeAssessmentSecurity } from "@/types/assessment-security";
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
  const [cameraStep, setCameraStep] = useState(false);
  const security = normalizeAssessmentSecurity(assessment.security);

  const requestFullscreenIfNeeded = () => {
    if (!security.requireFullscreen) return;
    try {
      sessionStorage.setItem("codeshield-exam-fs-intent", "1");
      if (
        document.documentElement.requestFullscreen &&
        !document.fullscreenElement
      ) {
        document.documentElement.requestFullscreen().catch(() => {
          sessionStorage.setItem("codeshield-exam-fs-denied", "1");
        });
      }
    } catch {
      sessionStorage.setItem("codeshield-exam-fs-denied", "1");
    }
  };

  const navigateToSession = (attemptId: string, deviceId?: string) => {
    try {
      if (deviceId) {
        sessionStorage.setItem("codeshield-exam-camera-device", deviceId);
      } else {
        sessionStorage.removeItem("codeshield-exam-camera-device");
      }
      if (security.requireCamera) {
        sessionStorage.setItem("codeshield-exam-camera-ok", "1");
      }
    } catch {
      // ignore
    }
    router.push(`/student/exam/session/${attemptId}`);
  };

  const startExam = (deviceId?: string) => {
    setError("");
    requestFullscreenIfNeeded();
    startTransition(async () => {
      if (activeAttemptId) {
        navigateToSession(activeAttemptId, deviceId);
        return;
      }
      const result = await startExamAction(assessment.id);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("attempt" in result && result.attempt) {
        navigateToSession(result.attempt.id, deviceId);
      }
    });
  };

  const onStartClick = () => {
    setError("");
    if (security.requireCamera) {
      setCameraStep(true);
      return;
    }
    startExam();
  };

  if (cameraStep) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background relative">
        <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
        <div className="relative card-soft p-8 max-w-lg w-full shadow-elevated">
          <CameraPrecheck
            onCancel={() => setCameraStep(false)}
            onConfirmed={({ deviceId }) => {
              setCameraStep(false);
              startExam(deviceId);
            }}
          />
          {error && (
            <p className="mt-4 text-sm text-danger font-medium">{error}</p>
          )}
        </div>
      </div>
    );
  }

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
                  security.requireCamera
                    ? "A working webcam is required for this assessment"
                    : "Camera is optional for this assessment",
                  security.requireFullscreen
                    ? "Stay in full-screen until you finish"
                    : "Fullscreen is not required",
                  security.blockCopyPaste
                    ? "Copy/paste and right-click are disabled"
                    : "Copy/paste is allowed",
                  security.monitorTabSwitching
                    ? "Tab switching is monitored and recorded"
                    : "Tab switching is not monitored",
                  security.requireFaceDetection
                    ? "Your face must remain visible to the camera during the exam"
                    : "",
                  security.requireHeadMonitoring
                    ? "Sustained looking away from the screen may be recorded as an observation"
                    : "",
                ].filter((line) => line.length > 0)
            ).map((line) => (
              <li key={line}>• {line.replace(/^•\s*/, "")}</li>
            ))}
          </ul>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            {
              icon: Camera,
              label: security.requireCamera
                ? security.requireHeadMonitoring
                  ? "Camera + head monitoring"
                  : security.requireFaceDetection
                    ? "Camera + face monitoring"
                    : "Camera required"
                : "Camera optional",
            },
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
          <Button className="flex-1" onClick={onStartClick} disabled={pending}>
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
