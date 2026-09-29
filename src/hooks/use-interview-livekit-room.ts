"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConnectionState,
  DisconnectReason,
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
} from "livekit-client";

const MAX_AUTO_RECONNECTS = 3;

function reconnectBackoffMs(attempt: number) {
  return 1000 * 2 ** attempt;
}

function isTerminalDisconnectReason(reason?: DisconnectReason) {
  return (
    reason === DisconnectReason.CLIENT_INITIATED ||
    reason === DisconnectReason.ROOM_DELETED ||
    reason === DisconnectReason.PARTICIPANT_REMOVED ||
    reason === DisconnectReason.DUPLICATE_IDENTITY
  );
}

function describeTerminalDisconnect(reason?: DisconnectReason) {
  switch (reason) {
    case DisconnectReason.ROOM_DELETED:
      return "The interview room has ended.";
    case DisconnectReason.PARTICIPANT_REMOVED:
      return "You were removed from the interview room.";
    case DisconnectReason.DUPLICATE_IDENTITY:
      return "Another session joined this interview with the same identity.";
    default:
      return "Disconnected from the interview room.";
  }
}

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

async function fetchInterviewRoomToken(interviewId: string): Promise<RoomTokenResponse> {
  let response: Response;
  try {
    response = await fetch(`/api/interviews/${interviewId}/room-token`);
  } catch (fetchError) {
    throw Object.assign(
      new Error("Token fetch failed. Check your network and retry."),
      { cause: fetchError },
    );
  }

  const payload = (await response.json()) as RoomTokenResponse & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      classifyInterviewRoomError(
        new Error(payload.error || "Unable to connect to interview room."),
        response.status,
      ),
    );
  }

  return payload;
}

function classifyInterviewRoomError(err: unknown, status?: number) {
  if (
    err instanceof DOMException &&
    (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")
  ) {
    return "Camera or microphone permission was denied. Allow access and retry.";
  }

  if (status === 404) {
    return "You are not authorized to join this interview.";
  }
  if (status === 503) {
    return "Video interview service is not configured.";
  }

  if (err instanceof TypeError) {
    return "Token fetch failed. Check your network and retry.";
  }

  const message = err instanceof Error ? err.message : "";
  if (/not authorized|Interview not available/i.test(message)) {
    return "You are not authorized to join this interview.";
  }
  if (/permission|NotAllowed|NotReadableError/i.test(message)) {
    return "Camera or microphone permission was denied. Allow access and retry.";
  }
  if (
    /websocket|could not establish|failed to connect|connection refused|unreachable|timeout/i.test(
      message,
    )
  ) {
    return "LiveKit is unreachable. Check the room URL and your network.";
  }
  return message || "Unable to connect to interview room.";
}

export function useInterviewLiveKitRoom(
  interviewId: string,
  enabled: boolean,
): InterviewLiveKitState {
  const roomRef = useRef<Room | null>(null);
  const connectAttemptRef = useRef(0);
  const intentionalDisconnectRef = useRef(false);
  const reconnectInFlightRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
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
    intentionalDisconnectRef.current = true;
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
        intentionalDisconnectRef.current = false;
        reconnectAttemptsRef.current = 0;
        const payload = await fetchInterviewRoomToken(interviewId);

        if (cancelled || attemptId !== connectAttemptRef.current) return;

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
        });
        roomRef.current = room;

        room.on(RoomEvent.Disconnected, (reason) => {
          if (cancelled || intentionalDisconnectRef.current) return;
          if (reason === DisconnectReason.CLIENT_INITIATED) return;
          if (isTerminalDisconnectReason(reason)) {
            setConnectionState(ConnectionState.Disconnected);
            setError(describeTerminalDisconnect(reason));
            return;
          }
          if (reconnectInFlightRef.current) return;
          if (reconnectAttemptsRef.current >= MAX_AUTO_RECONNECTS) {
            setConnectionState(ConnectionState.Disconnected);
            setError(
              "LiveKit is unreachable. Check the room URL and your network.",
            );
            return;
          }

          reconnectInFlightRef.current = true;
          void (async () => {
            let lastError: unknown;
            while (
              reconnectAttemptsRef.current < MAX_AUTO_RECONNECTS &&
              !cancelled &&
              !intentionalDisconnectRef.current
            ) {
              const attempt = reconnectAttemptsRef.current;
              await new Promise((resolve) =>
                setTimeout(resolve, reconnectBackoffMs(attempt)),
              );
              if (cancelled || intentionalDisconnectRef.current) return;
              try {
                const next = await fetchInterviewRoomToken(interviewId);
                if (cancelled || intentionalDisconnectRef.current) return;
                await room.connect(next.url, next.token);
                await room.localParticipant.setMicrophoneEnabled(true);
                await room.localParticipant.setCameraEnabled(true);
                syncLocalTracks(room);
                syncRemoteTracks(pickRemoteParticipant(room));
                setConnectionState(room.state);
                setError(null);
                reconnectAttemptsRef.current = 0;
                return;
              } catch (err) {
                lastError = err;
                reconnectAttemptsRef.current += 1;
              }
            }
            if (cancelled || intentionalDisconnectRef.current) return;
            setConnectionState(ConnectionState.Disconnected);
            setError(
              classifyInterviewRoomError(lastError) ||
                "LiveKit is unreachable. Check the room URL and your network.",
            );
          })().finally(() => {
            reconnectInFlightRef.current = false;
          });
        });

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
        setError(classifyInterviewRoomError(err));
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
    } catch (err) {
      setMicEnabled(room.localParticipant.isMicrophoneEnabled);
      setError(classifyInterviewRoomError(err));
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
    } catch (err) {
      setCameraEnabled(room.localParticipant.isCameraEnabled);
      setError(classifyInterviewRoomError(err));
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
