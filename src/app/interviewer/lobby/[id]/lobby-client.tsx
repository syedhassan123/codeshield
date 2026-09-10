"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Mic, Wifi } from "lucide-react";
import {
  classifyCameraError,
  classifyMicError,
  describeVideoTrackSettings,
  hasActiveAudioTrack,
  hasActiveVideoTrack,
  isGetUserMediaSupported,
  openCameraMicStream,
  stopMediaStream,
} from "@/lib/camera/browser";
import type { InterviewRoomContext } from "@/lib/interviewer/queries";
import { Button } from "@/components/ui/button";

type LobbyClientProps = {
  interview: InterviewRoomContext;
  interviewId: string;
  participantRole: "student" | "interviewer";
  livekitConfigured: boolean;
};

type CheckState = "pending" | "ok" | "error";

export function InterviewLobbyClient({
  interview,
  interviewId,
  participantRole,
  livekitConfigured,
}: LobbyClientProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraState, setCameraState] = useState<CheckState>("pending");
  const [micState, setMicState] = useState<CheckState>("pending");
  const [cameraDetail, setCameraDetail] = useState("Checking…");
  const [micDetail, setMicDetail] = useState("Checking…");
  const [networkDetail, setNetworkDetail] = useState("Checking…");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const cancelHref =
    participantRole === "student" ? "/student/interviews" : "/interviewer";

  const stopPreview = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const runChecks = useCallback(async () => {
    setChecking(true);
    setError("");
    setCameraState("pending");
    setMicState("pending");
    setCameraDetail("Checking…");
    setMicDetail("Checking…");
    stopPreview();

    if (!isGetUserMediaSupported()) {
      setError(
        "This browser does not support camera or microphone access. Use a recent Chrome, Edge, or Firefox.",
      );
      setCameraState("error");
      setMicState("error");
      setCameraDetail("Unsupported browser");
      setMicDetail("Unsupported browser");
      setChecking(false);
      return;
    }

    setNetworkDetail(
      typeof navigator !== "undefined" && navigator.onLine
        ? "Network connection detected"
        : "No network connection detected",
    );

    try {
      const stream = await openCameraMicStream();
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      if (hasActiveVideoTrack(stream)) {
        setCameraState("ok");
        setCameraDetail(describeVideoTrackSettings(stream));
      } else {
        setCameraState("error");
        setCameraDetail("Camera unavailable");
      }

      if (hasActiveAudioTrack(stream)) {
        setMicState("ok");
        setMicDetail("Microphone active");
      } else {
        setMicState("error");
        setMicDetail("Microphone unavailable");
      }
    } catch (err) {
      const cameraErr = classifyCameraError(err);
      const micErr = classifyMicError(err);
      setCameraState("error");
      setMicState("error");
      setCameraDetail(cameraErr.message);
      setMicDetail(micErr.message);
      setError(cameraErr.message || micErr.message);
    } finally {
      setChecking(false);
    }
  }, [stopPreview]);

  useEffect(() => {
    void runChecks();
    return () => stopPreview();
  }, [runChecks, stopPreview]);

  const canJoin =
    livekitConfigured &&
    cameraState === "ok" &&
    micState === "ok" &&
    !checking &&
    (typeof navigator === "undefined" || navigator.onLine);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative">
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
      <div className="relative card-soft p-8 max-w-lg w-full shadow-elevated">
        <h1 className="font-display font-bold text-2xl">Interview Lobby</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Run final checks before joining the room
        </p>

        <div className="mt-4 rounded-xl border border-border p-4 space-y-1">
          <div className="font-semibold text-sm">{interview.title}</div>
          <div className="text-[11px] text-muted-foreground">
            {interview.candidateName} · {interview.type} ·{" "}
            {interview.formattedDate} · {interview.formattedTime} ·{" "}
            {interview.durationMin} min
          </div>
        </div>

        <div className="mt-6 aspect-video rounded-2xl bg-slate-900 text-white flex items-center justify-center relative overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 h-full w-full object-cover"
          />
          {cameraState !== "ok" && (
            <Camera className="w-10 h-10 text-white/50 relative z-10" />
          )}
          <div className="absolute top-3 left-3 text-[11px] font-semibold bg-black/50 px-2 py-1 rounded">
            {cameraState === "ok" ? cameraDetail : "Camera preview"}
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {[
            {
              icon: Camera,
              label: "Camera Check",
              value: cameraDetail,
              state: cameraState,
            },
            {
              icon: Mic,
              label: "Microphone Check",
              value: micDetail,
              state: micState,
            },
            {
              icon: Wifi,
              label: "Internet Check",
              value: networkDetail,
              state:
                typeof navigator !== "undefined" && navigator.onLine
                  ? ("ok" as const)
                  : ("error" as const),
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 p-3 rounded-xl border border-border"
            >
              <item.icon className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <div className="text-sm font-semibold">{item.label}</div>
                <div
                  className={`text-[11px] ${
                    item.state === "error"
                      ? "text-danger"
                      : item.state === "ok"
                        ? "text-success"
                        : "text-muted-foreground"
                  }`}
                >
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {!livekitConfigured && (
          <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
            Video interview service is not configured. Contact your administrator.
          </div>
        )}

        {error ? (
          <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        ) : null}

        <div className="mt-6 flex gap-3">
          <Button asChild variant="outline" className="flex-1">
            <Link href={cancelHref} onClick={stopPreview}>
              Cancel
            </Link>
          </Button>
          {canJoin ? (
            <Button asChild className="flex-1">
              <Link href={`/interviewer/room/${interviewId}`} onClick={stopPreview}>
                Join Interview
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              className="flex-1"
              disabled={checking}
              onClick={() => void runChecks()}
            >
              {checking ? "Checking…" : "Retry checks"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
