"use client";

import { useState, useTransition } from "react";
import { getRecordingPlaybackUrlAction } from "@/lib/actions/exam-recording";
import type { SerializedExamRecording } from "@/lib/actions/exam-recording";
import type { AssessmentSecuritySettings } from "@/types/assessment-security";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatDuration(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function AdminProctoringReport({
  securitySettings,
  recording,
}: {
  securitySettings?: AssessmentSecuritySettings | null;
  recording: SerializedExamRecording | null;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const loadPlayback = () => {
    if (!recording) return;
    setError("");
    startTransition(async () => {
      const res = await getRecordingPlaybackUrlAction(recording.id);
      if ("error" in res && res.error) {
        setError(res.error);
        return;
      }
      if ("url" in res && res.url) {
        setUrl(res.url);
      }
    });
  };

  return (
    <div className="card-soft p-5 mb-5">
      <h3 className="font-display font-bold mb-4">Proctoring / Camera</h3>
      <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
        <Row
          label="Camera Required"
          value={securitySettings?.requireCamera ? "Yes" : "No"}
        />
        <Row
          label="Camera Status"
          value={
            recording
              ? recording.status === "READY"
                ? "Available"
                : recording.status
              : securitySettings?.requireCamera
                ? "No recording"
                : "Not required"
          }
        />
        <Row
          label="Recording"
          value={recording?.status ?? "—"}
        />
        <Row
          label="Duration"
          value={
            recording ? formatDuration(recording.durationSeconds) : "—"
          }
        />
        <Row
          label="Started"
          value={
            recording
              ? new Date(recording.startedAt).toLocaleString()
              : "—"
          }
        />
        <Row
          label="Ended"
          value={
            recording?.endedAt
              ? new Date(recording.endedAt).toLocaleString()
              : "—"
          }
        />
      </div>

      {recording?.status === "READY" && (
        <div className="space-y-3">
          <Button size="sm" onClick={loadPlayback} disabled={pending}>
            {pending ? "Loading…" : url ? "Refresh link" : "View Recording"}
          </Button>
          {url && (
            <video
              key={url}
              src={url}
              controls
              className="w-full max-w-2xl rounded-xl border border-border bg-black"
            />
          )}
        </div>
      )}

      {recording?.status === "FAILED" && (
        <p className="text-sm text-danger font-medium">
          Recording failed{recording.errorMessage ? `: ${recording.errorMessage}` : "."}
        </p>
      )}

      {error && (
        <p className="mt-2 text-sm text-danger font-medium">{error}</p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className={cn("font-semibold mt-0.5")}>{value}</div>
    </div>
  );
}
