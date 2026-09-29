import { AccessToken } from "livekit-server-sdk";
import { getLiveKitConfig } from "@/lib/livekit/config";

export type InterviewParticipantRole = "student" | "interviewer";

export function getInterviewRoomName(interviewId: string) {
  return `interview:${interviewId}`;
}

export function getParticipantIdentity(userId: string) {
  return `user:${userId}`;
  
}

/** Short-lived room JWT. The client fetches a fresh token on reconnect. */
export const INTERVIEW_ROOM_TOKEN_TTL_SECONDS = 15 * 60;

export function computeInterviewTokenTtlSeconds(_durationMin = 0) {
  return INTERVIEW_ROOM_TOKEN_TTL_SECONDS;
}

export async function createInterviewRoomToken(params: {
  interviewId: string;
  userId: string;
  role: InterviewParticipantRole;
  displayName: string;
  durationMin: number;
}) {
  const { url, apiKey, apiSecret } = getLiveKitConfig();
  const roomName = getInterviewRoomName(params.interviewId);
  const identity = getParticipantIdentity(params.userId);
  const ttlSeconds = computeInterviewTokenTtlSeconds(params.durationMin);

  const token = new AccessToken(apiKey, apiSecret, {
    identity,
    name: params.displayName,
    ttl: ttlSeconds,
    metadata: JSON.stringify({ role: params.role }),
  });

  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });

  return {
    token: await token.toJwt(),
    url,
    roomName,
    identity,
    ttlSeconds,
  };
}
