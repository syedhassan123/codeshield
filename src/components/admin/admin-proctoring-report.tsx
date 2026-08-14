"use client";

import { useState, useTransition } from "react";
import { getRecordingPlaybackUrlAction } from "@/lib/actions/exam-recording";
import type { SerializedExamRecording } from "@/lib/actions/exam-recording";
import type { SerializedSecurityEvent } from "@/lib/actions/exam-security";
import type { AssessmentSecuritySettings } from "@/types/assessment-security";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FACE_EVENT_TYPES = new Set([
  "FACE_DETECTED",
  "NO_FACE_DETECTED",
  "MULTIPLE_FACES_DETECTED",
  "FACE_DETECTION_UNAVAILABLE",
]);

const HEAD_EVENT_TYPES = new Set([
  "HEAD_LOOKING_LEFT",
  "HEAD_LOOKING_RIGHT",
  "HEAD_LOOKING_UP",
  "HEAD_LOOKING_DOWN",
  "PROLONGED_LOOKING_AWAY",
  "REPEATED_LOOKING_AWAY",
  "HEAD_MONITORING_UNAVAILABLE",
]);

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

function formatDurationMs(ms: unknown) {
  if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
  return `${(ms / 1000).toFixed(1)} sec`;
}

export function AdminProctoringReport({
  securitySettings,
  recording,
  securityEvents = [],
}: {
  securitySettings?: AssessmentSecuritySettings | null;
  recording: SerializedExamRecording | null;
  securityEvents?: SerializedSecurityEvent[];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const faceEvents = securityEvents.filter((e) =>
    FACE_EVENT_TYPES.has(e.eventType),
  );
  const noFaceCount = faceEvents.filter(
    (e) => e.eventType === "NO_FACE_DETECTED",
  ).length;
  const multipleFaceCount = faceEvents.filter(
    (e) => e.eventType === "MULTIPLE_FACES_DETECTED",
  ).length;
  const observationEvents = faceEvents.filter(
    (e) =>
      e.eventType === "NO_FACE_DETECTED" ||
      e.eventType === "MULTIPLE_FACES_DETECTED",
  );

  const headEvents = securityEvents.filter((e) =>
    HEAD_EVENT_TYPES.has(e.eventType),
  );
  const headObservationEvents = headEvents.filter(
    (e) =>
      e.eventType.startsWith("HEAD_LOOKING_") ||
      e.eventType === "PROLONGED_LOOKING_AWAY" ||
      e.eventType === "REPEATED_LOOKING_AWAY",
  );
  const repeatedHeadCount = headEvents.filter(
    (e) => e.eventType === "REPEATED_LOOKING_AWAY",
  ).length;

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
          label="Face Monitoring"
          value={securitySettings?.requireFaceDetection ? "Enabled" : "Disabled"}
        />
        <Row
          label="Head Monitoring"
          value={
            securitySettings?.requireHeadMonitoring ? "Enabled" : "Disabled"
          }
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

      {securitySettings?.requireFaceDetection && (
        <div className="rounded-xl border border-border p-4 mb-4">
          <h4 className="text-sm font-semibold mb-3">Face monitoring events</h4>
          <p className="text-xs text-muted-foreground mb-3">
            Objective camera observations only — not a confirmed misconduct
            determination.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
            <Row label="No face events" value={String(noFaceCount)} />
            <Row
              label="Multiple face events"
              value={String(multipleFaceCount)}
            />
          </div>
          {observationEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No face monitoring observations recorded for this attempt.
            </p>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {observationEvents.map((event) => {
                const duration = formatDurationMs(event.metadata.durationMs);
                return (
                  <li
                    key={event.id}
                    className="rounded-xl border border-border px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold">
                      {new Date(event.timestamp).toLocaleTimeString()} ·{" "}
                      {event.eventType.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {duration ? `Duration: ${duration}` : "Duration: —"}
                      {typeof event.metadata.faceCount === "number"
                        ? ` · Faces: ${event.metadata.faceCount}`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {securitySettings?.requireHeadMonitoring && (
        <div className="rounded-xl border border-border p-4 mb-4">
          <h4 className="text-sm font-semibold mb-3">
            Head movement observations
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            Sustained head orientation observations — not a confirmed misconduct
            determination.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-sm mb-4">
            <Row
              label="Looking-away observations"
              value={String(
                headObservationEvents.filter((e) =>
                  e.eventType.startsWith("HEAD_LOOKING_"),
                ).length,
              )}
            />
            <Row
              label="Prolonged observations"
              value={String(
                headEvents.filter((e) => e.eventType === "PROLONGED_LOOKING_AWAY")
                  .length,
              )}
            />
            <Row
              label="Repeated pattern events"
              value={String(repeatedHeadCount)}
            />
          </div>
          {headObservationEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No head movement observations recorded for this attempt.
            </p>
          ) : (
            <ul className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {headObservationEvents.map((event) => {
                const duration = formatDurationMs(event.metadata.durationMs);
                const direction =
                  typeof event.metadata.direction === "string"
                    ? event.metadata.direction
                    : null;
                const episodeCount =
                  typeof event.metadata.episodeCount === "number"
                    ? event.metadata.episodeCount
                    : null;
                const windowMs =
                  typeof event.metadata.windowMs === "number"
                    ? event.metadata.windowMs
                    : null;
                return (
                  <li
                    key={event.id}
                    className="rounded-xl border border-border px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold">
                      {new Date(event.timestamp).toLocaleTimeString()} ·{" "}
                      {event.eventType.replaceAll("_", " ")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {duration ? `Duration: ${duration}` : ""}
                      {direction ? ` · Direction: ${direction}` : ""}
                      {episodeCount != null && windowMs != null
                        ? ` · ${episodeCount} episodes / ${Math.round(windowMs / 60_000)} min`
                        : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

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
