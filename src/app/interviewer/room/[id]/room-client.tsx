"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConnectionState } from "livekit-client";
import { Camera, CameraOff, Mic, MicOff, PhoneOff } from "lucide-react";
import {
  completeInterviewAction,
  startInterviewAction,
} from "@/lib/actions/interviewer";
import { AudioTrack, VideoTrack } from "@/components/interview/video-track";
import { useInterviewLiveKitRoom } from "@/hooks/use-interview-livekit-room";
import { interviewQuestions } from "@/lib/mock-data";
import type { InterviewRoomContext } from "@/lib/interviewer/queries";
import { cn } from "@/lib/utils";

type InterviewRoomClientProps = {
  interview: InterviewRoomContext;
  participantRole: "student" | "interviewer";
  livekitConfigured: boolean;
};

function connectionLabel(state: ConnectionState | "idle") {
  switch (state) {
    case ConnectionState.Connected:
      return "Connected";
    case ConnectionState.Connecting:
      return "Connecting…";
    case ConnectionState.Reconnecting:
      return "Reconnecting…";
    case ConnectionState.Disconnected:
      return "Disconnected";
    default:
      return "Connecting…";
  }
}

export function InterviewRoomClient({
  interview,
  participantRole,
  livekitConfigured,
}: InterviewRoomClientProps) {
  const router = useRouter();
  const canComplete = participantRole === "interviewer";
  const startedRef = useRef(false);
  const [tab, setTab] = useState<"questions" | "code" | "notes">("questions");
  const [qIndex, setQIndex] = useState(0);
  const [notes, setNotes] = useState("");
  const [code, setCode] = useState(`// Candidate's coding workspace\n`);
  const [endError, setEndError] = useState("");
  const [ending, startEndTransition] = useTransition();
  const [leaving, setLeaving] = useState(false);

  const livekit = useInterviewLiveKitRoom(
    interview.id,
    livekitConfigured,
  );

  useEffect(() => {
    if (
      !canComplete ||
      startedRef.current ||
      livekit.connectionState !== ConnectionState.Connected
    ) {
      return;
    }

    startedRef.current = true;
    void startInterviewAction(interview.id);
  }, [canComplete, interview.id, livekit.connectionState]);

  const waitingMessage =
    participantRole === "student"
      ? "Waiting for interviewer…"
      : "Waiting for candidate…";

  const remoteLabel =
    participantRole === "interviewer"
      ? interview.candidateName
      : "Interviewer";

  const handleEndInterview = () => {
    if (ending) return;
    setEndError("");
    startEndTransition(async () => {
      const result = await completeInterviewAction(interview.id);
      if ("error" in result && result.error) {
        setEndError(result.error);
        return;
      }
      await livekit.disconnect();
      router.push(`/interviewer/evaluations/${interview.id}`);
      router.refresh();
    });
  };

  const handleLeave = async () => {
    if (leaving) return;
    setLeaving(true);
    await livekit.disconnect();
    router.push("/student/interviews");
    router.refresh();
  };

  if (!livekitConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-display font-bold text-xl">Interview unavailable</h1>
          <p className="text-sm text-slate-400">
            Video interview service is not configured. Contact your administrator.
          </p>
          <Link
            href={
              participantRole === "student"
                ? "/student/interviews"
                : "/interviewer"
            }
            className="inline-flex px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
          >
            Return to interviews
          </Link>
        </div>
      </div>
    );
  }

  if (livekit.error && livekit.connectionState !== ConnectionState.Connected) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="font-display font-bold text-xl">
            Unable to connect to interview room
          </h1>
          <p className="text-sm text-slate-400">{livekit.error}</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={livekit.retry}
              className="inline-flex px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold"
            >
              Retry
            </button>
            <Link
              href={
                participantRole === "student"
                  ? "/student/interviews"
                  : "/interviewer"
              }
              className="inline-flex px-4 py-2 rounded-lg border border-slate-700 text-sm font-semibold"
            >
              Return to interviews
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <header className="h-14 border-b border-slate-800 px-4 flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">{interview.title}</div>
          <div className="text-[11px] text-slate-400">
            {interview.candidateName} · {interview.type}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full border",
              livekit.connectionState === ConnectionState.Connected
                ? "border-success/40 text-success"
                : "border-amber-500/40 text-amber-300",
            )}
          >
            <span
              className={cn(
                "w-2 h-2 rounded-full",
                livekit.connectionState === ConnectionState.Connected
                  ? "bg-success"
                  : "bg-amber-400 animate-pulse",
              )}
            />
            {connectionLabel(livekit.connectionState)}
          </span>
          <button
            type="button"
            onClick={() => void livekit.toggleMic()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700"
            aria-label={livekit.micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {livekit.micEnabled ? (
              <Mic className="w-3.5 h-3.5" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-danger" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void livekit.toggleCamera()}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700"
            aria-label={livekit.cameraEnabled ? "Turn camera off" : "Turn camera on"}
          >
            {livekit.cameraEnabled ? (
              <Camera className="w-3.5 h-3.5" />
            ) : (
              <CameraOff className="w-3.5 h-3.5 text-danger" />
            )}
          </button>
        </div>
        {canComplete ? (
          <button
            type="button"
            onClick={handleEndInterview}
            disabled={ending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-semibold disabled:opacity-60"
          >
            <PhoneOff className="w-4 h-4" /> {ending ? "Ending…" : "End"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleLeave()}
            disabled={leaving}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger text-white text-xs font-semibold disabled:opacity-60"
          >
            <PhoneOff className="w-4 h-4" /> {leaving ? "Leaving…" : "Leave"}
          </button>
        )}
      </header>
      {endError ? (
        <div className="px-4 py-2 text-xs text-red-300 bg-red-950/50 border-b border-red-900">
          {endError}
        </div>
      ) : null}

      <AudioTrack track={livekit.remoteAudioTrack} />

      <div className="flex-1 grid lg:grid-cols-[1.1fr_1fr] min-h-0">
        <section className="p-4 grid grid-rows-2 gap-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 relative overflow-hidden min-h-[180px]">
            {livekit.remoteVideoTrack ? (
              <VideoTrack
                track={livekit.remoteVideoTrack}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="h-full flex items-center justify-center px-4 text-center">
                <div>
                  <div className="w-20 h-20 rounded-full bg-primary/30 flex items-center justify-center font-bold text-xl mx-auto">
                    {participantRole === "interviewer"
                      ? interview.candidateInitials
                      : interview.interviewerInitials}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">{waitingMessage}</p>
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 text-xs font-semibold bg-black/50 px-2 py-1 rounded">
              {remoteLabel}
              {livekit.remoteParticipant ? "" : " · Offline"}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 relative overflow-hidden min-h-[180px]">
            {livekit.localVideoTrack && livekit.cameraEnabled ? (
              <VideoTrack
                track={livekit.localVideoTrack}
                muted
                className="absolute inset-0 h-full w-full object-cover [transform:scaleX(-1)]"
              />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xl">
                  {participantRole === "interviewer"
                    ? interview.interviewerInitials
                    : interview.candidateInitials}
                </div>
              </div>
            )}
            <div className="absolute bottom-3 left-3 text-xs font-semibold bg-black/50 px-2 py-1 rounded">
              You
              {!livekit.cameraEnabled ? " · Camera off" : ""}
            </div>
          </div>
        </section>

        <section className="border-l border-slate-800 flex flex-col min-h-0">
          <div className="p-4 border-b border-slate-800">
            <h3 className="font-semibold text-sm mb-3">Session</h3>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {[
                ["Connection", connectionLabel(livekit.connectionState)],
                [
                  "Remote participant",
                  livekit.remoteParticipant ? "Connected" : "Waiting",
                ],
                ["Your microphone", livekit.micEnabled ? "On" : "Muted"],
                ["Your camera", livekit.cameraEnabled ? "On" : "Off"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg bg-slate-900 border border-slate-800 p-2"
                >
                  <div className="text-slate-400">{label}</div>
                  <div className="font-semibold mt-0.5">{value}</div>
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
