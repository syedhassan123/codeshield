"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Track } from "livekit-client";
import { uploadInterviewRecordingAction } from "@/lib/actions/interview-recording";
import {
  isMediaRecorderSupported,
  pickSupportedRecorderMimeType,
  waitForRecorderStop,
} from "@/lib/camera/browser";

type Options = {
  interviewId: string;
  recordingId: string | null;
  enabled: boolean;
  videoTrack: Track | null;
  audioTrack: Track | null;
};

function tracksToStream(videoTrack: Track | null, audioTrack: Track | null) {
  const stream = new MediaStream();
  const video = videoTrack?.mediaStreamTrack;
  const audio = audioTrack?.mediaStreamTrack;
  if (video) stream.addTrack(video);
  if (audio) stream.addTrack(audio);
  return stream.getTracks().length > 0 ? stream : null;
}

export function useInterviewRecording({
  interviewId,
  recordingId,
  enabled,
  videoTrack,
  audioTrack,
}: Options) {
  const [status, setStatus] = useState<
    "idle" | "recording" | "uploading" | "ready" | "failed"
  >("idle");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const mimeTypeRef = useRef("");
  const recordingIdRef = useRef(recordingId);
  const pendingBlobRef = useRef<Blob | null>(null);

  recordingIdRef.current = recordingId;

  useEffect(() => {
    if (!enabled || !recordingId) return;
    if (!isMediaRecorderSupported()) return;
    if (recorderRef.current) return;

    const stream = tracksToStream(videoTrack, audioTrack);
    if (!stream) return;

    const mimeType = pickSupportedRecorderMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);
    mimeTypeRef.current = recorder.mimeType || mimeType || "video/webm";
    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.start(2000);
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setStatus("recording");

    return () => {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, [audioTrack, enabled, recordingId, videoTrack]);

  const stopAndUpload = useCallback(async () => {
    const id = recordingIdRef.current;
    const recorder = recorderRef.current;
    if (!id) return;
    if (!recorder && !pendingBlobRef.current && chunksRef.current.length === 0) {
      return;
    }

    try {
      if (recorder && recorder.state !== "inactive") {
        await waitForRecorderStop(recorder, 8000);
      }
    } catch {
      // continue with whatever chunks we have
    }
    recorderRef.current = null;

    const blob =
      pendingBlobRef.current ||
      new Blob(chunksRef.current, {
        type: mimeTypeRef.current || "video/webm",
      });
    pendingBlobRef.current = blob.size > 0 ? blob : null;
    chunksRef.current = [];

    if (!pendingBlobRef.current || pendingBlobRef.current.size <= 0) {
      setStatus("failed");
      return;
    }

    setStatus("uploading");
    const form = new FormData();
    form.set("interviewId", interviewId);
    form.set("recordingId", id);
    form.set(
      "file",
      pendingBlobRef.current,
      `interview.${mimeTypeRef.current.includes("mp4") ? "mp4" : "webm"}`,
    );

    try {
      const result = await uploadInterviewRecordingAction(form);
      if ("error" in result && result.error) {
        setStatus("failed");
        return;
      }
      pendingBlobRef.current = null;
      setStatus("ready");
    } catch {
      setStatus("failed");
    }
  }, [interviewId]);

  return { status, stopAndUpload };
}
