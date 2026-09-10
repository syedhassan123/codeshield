"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
} from "livekit-client";

export type RoomTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  participantRole: "student" | "interviewer";
};

export type InterviewLiveKitState = {
  connectionState: ConnectionState | "idle";
  error: string | null;
  remoteParticipant: RemoteParticipant | null;
  localVideoTrack: Track | null;
  localAudioTrack: Track | null;
  remoteVideoTrack: Track | null;
  remoteAudioTrack: Track | null;
  micEnabled: boolean;
  cameraEnabled: boolean;
  retry: () => void;
  toggleMic: () => Promise<void>;
  toggleCamera: () => Promise<void>;
  disconnect: () => Promise<void>;
};

function pickRemoteParticipant(room: Room) {
  const participants = [...room.remoteParticipants.values()];
  return participants[0] ?? null;
}

function pickVideoTrack(participant: { getTrackPublication: (source: Track.Source) => { track?: Track } | undefined } | null, source: Track.Source) {
  return participant?.getTrackPublication(source)?.track ?? null;
}

export function useInterviewLiveKitRoom(
  interviewId: string,
  enabled: boolean,
): InterviewLiveKitState {
  const roomRef = useRef<Room | null>(null);
  const connectAttemptRef = useRef(0);
  const [connectionState, setConnectionState] = useState<
    ConnectionState | "idle"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [remoteParticipant, setRemoteParticipant] =
    useState<RemoteParticipant | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<Track | null>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<Track | null>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<Track | null>(null);
  const [remoteAudioTrack, setRemoteAudioTrack] = useState<Track | null>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [connectNonce, setConnectNonce] = useState(0);

  const syncLocalTracks = useCallback((room: Room) => {
    setLocalVideoTrack(
      room.localParticipant.getTrackPublication(Track.Source.Camera)?.track ??
        null,
    );
    setLocalAudioTrack(
      room.localParticipant.getTrackPublication(Track.Source.Microphone)?.track ??
        null,
    );
    setMicEnabled(room.localParticipant.isMicrophoneEnabled);
    setCameraEnabled(room.localParticipant.isCameraEnabled);
  }, []);

  const syncRemoteTracks = useCallback((participant: RemoteParticipant | null) => {
    setRemoteParticipant(participant);
    setRemoteVideoTrack(pickVideoTrack(participant, Track.Source.Camera));
    setRemoteAudioTrack(pickVideoTrack(participant, Track.Source.Microphone));
  }, []);

  const disconnect = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    if (!room) return;
    room.removeAllListeners();
    await room.disconnect(true);
    setRemoteParticipant(null);
    setLocalVideoTrack(null);
    setLocalAudioTrack(null);
    setRemoteVideoTrack(null);
    setRemoteAudioTrack(null);
    setConnectionState("idle");
  }, []);

  const retry = useCallback(() => {
    setConnectNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const attemptId = ++connectAttemptRef.current;

    async function connect() {
      setError(null);
      setConnectionState(ConnectionState.Connecting);

      try {
        const response = await fetch(`/api/interviews/${interviewId}/room-token`);
        const payload = (await response.json()) as RoomTokenResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || "Unable to connect to interview room.");
        }

        if (cancelled || attemptId !== connectAttemptRef.current) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.ConnectionStateChanged, (state) => {
          if (cancelled) return;
          setConnectionState(state);
        });

        room.on(RoomEvent.ParticipantConnected, (participant) => {
          if (cancelled) return;
          syncRemoteTracks(participant);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          if (cancelled) return;
          setRemoteParticipant((current) =>
            current?.identity === participant.identity ? null : current,
          );
          setRemoteVideoTrack(null);
          setRemoteAudioTrack(null);
        });

        room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
          if (cancelled) return;
          if (participant.identity === room.localParticipant.identity) return;
          syncRemoteTracks(participant as RemoteParticipant);
          if (track.kind === Track.Kind.Video) {
            setRemoteVideoTrack(track);
          }
          if (track.kind === Track.Kind.Audio) {
            setRemoteAudioTrack(track);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track, _pub, participant) => {
          if (cancelled) return;
          track.detach();
          if (participant.identity === room.localParticipant.identity) return;
          syncRemoteTracks(participant as RemoteParticipant);
        });

        room.on(RoomEvent.LocalTrackPublished, () => {
          if (cancelled) return;
          syncLocalTracks(room);
        });

        room.on(RoomEvent.LocalTrackUnpublished, () => {
          if (cancelled) return;
          syncLocalTracks(room);
        });

        await room.connect(payload.url, payload.token);
        if (cancelled || attemptId !== connectAttemptRef.current) {
          await room.disconnect(true);
          return;
        }

        await room.localParticipant.setMicrophoneEnabled(true);
        await room.localParticipant.setCameraEnabled(true);
        syncLocalTracks(room);
        syncRemoteTracks(pickRemoteParticipant(room));
        setConnectionState(room.state);
      } catch (err) {
        if (cancelled || attemptId !== connectAttemptRef.current) return;
        setConnectionState(ConnectionState.Disconnected);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to connect to interview room.",
        );
      }
    }

    void connect();

    return () => {
      cancelled = true;
      void disconnect();
    };
  }, [
    connectNonce,
    disconnect,
    enabled,
    interviewId,
    syncLocalTracks,
    syncRemoteTracks,
  ]);

  const toggleMic = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isMicrophoneEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicEnabled(next);
      syncLocalTracks(room);
    } catch {
      setMicEnabled(room.localParticipant.isMicrophoneEnabled);
      setError("Unable to change microphone state.");
    }
  }, [syncLocalTracks]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isCameraEnabled;
    try {
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
      syncLocalTracks(room);
    } catch {
      setCameraEnabled(room.localParticipant.isCameraEnabled);
      setError("Unable to change camera state.");
    }
  }, [syncLocalTracks]);

  return {
    connectionState,
    error,
    remoteParticipant,
    localVideoTrack,
    localAudioTrack,
    remoteVideoTrack,
    remoteAudioTrack,
    micEnabled,
    cameraEnabled,
    retry,
    toggleMic,
    toggleCamera,
    disconnect,
  };
}
