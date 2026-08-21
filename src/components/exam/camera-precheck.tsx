"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  classifyCameraError,
  isGetUserMediaSupported,
  listVideoInputDevices,
  openCameraStream,
  stopMediaStream,
  type CameraDeviceOption,
} from "@/lib/camera/browser";
import { Button } from "@/components/ui/button";
import { recordExamSecurityEventAction } from "@/lib/actions/exam-security";

export type CameraPrecheckResult = {
  deviceId: string;
};

export function CameraPrecheck({
  attemptIdForEvents,
  onConfirmed,
  onCancel,
}: {
  /** Optional attempt id — usually empty before start; events logged after start separately. */
  attemptIdForEvents?: string | null;
  onConfirmed: (result: CameraPrecheckResult) => void;
  onCancel: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<CameraDeviceOption[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const stop = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startPreview = useCallback(
    async (preferredDeviceId?: string) => {
      setPending(true);
      setError("");
      setReady(false);
      stop();

      if (!isGetUserMediaSupported()) {
        setError(
          "This browser does not support camera access. Please use a recent version of Chrome, Edge, or Firefox.",
        );
        setPending(false);
        return;
      }

      try {
        const stream = await openCameraStream(preferredDeviceId || undefined);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        const list = await listVideoInputDevices();
        setDevices(list);
        const activeId =
          preferredDeviceId ||
          stream.getVideoTracks()[0]?.getSettings().deviceId ||
          list[0]?.deviceId ||
          "";
        setDeviceId(activeId);
        setReady(true);
      } catch (err) {
        const classified = classifyCameraError(err);
        setError(classified.message);
        if (attemptIdForEvents) {
          await recordExamSecurityEventAction({
            attemptId: attemptIdForEvents,
            eventType:
              classified.code === "PERMISSION_DENIED"
                ? "CAMERA_PERMISSION_DENIED"
                : "CAMERA_UNAVAILABLE",
            metadata: { phase: "precheck" },
          });
        }
      } finally {
        setPending(false);
      }
    },
    [attemptIdForEvents, stop],
  );

  useEffect(() => {
    void startPreview();
    return () => stop();
  }, [startPreview, stop]);

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const onDeviceChange = () => {
      if (!streamRef.current) return;
      const track = streamRef.current.getVideoTracks()[0];
      if (track && track.readyState === "ended") {
        setReady(false);
        setError(
          "Camera was disconnected. Reconnect your webcam and tap Check again.",
        );
      }
    };
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", onDeviceChange);
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display font-bold text-xl">Camera Required</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This assessment requires a working camera. Please connect or enable a
          webcam and allow camera access to continue.
        </p>
      </div>

      <div className="rounded-xl overflow-hidden border border-border bg-black aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />
      </div>

      {devices.length > 1 && (
        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Camera
          </label>
          <select
            className="mt-1.5 w-full h-11 rounded-xl border border-border bg-card px-3 text-sm"
            value={deviceId}
            onChange={(e) => {
              const id = e.target.value;
              setDeviceId(id);
              void startPreview(id);
            }}
          >
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {ready && (
        <p className="text-sm font-semibold text-success">Camera working ✓</p>
      )}
      {error && (
        <p className="text-sm font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="outline"
          className="flex-1"
          disabled={pending}
          onClick={() => void startPreview(deviceId || undefined)}
        >
          {pending ? "Checking…" : "Check again"}
        </Button>
        <Button
          className="flex-1"
          disabled={!ready || pending}
          onClick={() => {
            stop();
            onConfirmed({ deviceId });
          }}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
