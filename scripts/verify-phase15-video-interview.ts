/**
 * Phase 15 LiveKit video interview checks.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase15-video-interview.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { authorizeInterviewRoomAccess } from "../src/lib/interviewer/room-access";
import { isInterviewJoinable } from "../src/lib/interviewer/lifecycle";
import { connectDB } from "../src/lib/db";
import {
  computeInterviewTokenTtlSeconds,
  createInterviewRoomToken,
  getInterviewRoomName,
  getParticipantIdentity,
} from "../src/lib/livekit/room";
import { isLiveKitConfigured } from "../src/lib/livekit/config";
import { Interview } from "../src/models/Interview";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

async function staticChecks() {
  assert(
    fs.existsSync("src/lib/livekit/config.ts"),
    "LiveKit config module exists",
  );
  assert(fs.existsSync("src/lib/livekit/room.ts"), "LiveKit room module exists");
  assert(
    fs.existsSync("src/app/api/interviews/[id]/room-token/route.ts"),
    "room token API route exists",
  );

  const roomClient = read("src/app/interviewer/room/[id]/room-client.tsx");
  assert(
    roomClient.includes("useInterviewLiveKitRoom"),
    "room uses LiveKit hook",
  );
  assert(!roomClient.includes("REC"), "fake REC indicator removed");
  assert(!roomClient.includes("AI Monitoring"), "fake AI monitoring removed");

  const lobbyClient = read("src/app/interviewer/lobby/[id]/lobby-client.tsx");
  assert(lobbyClient.includes("openCameraMicStream"), "lobby uses real media checks");
  assert(!lobbyClient.includes("HD 720p detected"), "fake camera success removed");

  const tokenRoute = read("src/app/api/interviews/[id]/room-token/route.ts");
  assert(
    tokenRoute.includes("authorizeInterviewRoomAccess"),
    "token route uses ownership gate",
  );
  assert(
    !tokenRoute.includes("roomName:") || tokenRoute.includes("createInterviewRoomToken"),
    "room name derived server-side",
  );

  const clientSources = [
    "src/app/interviewer/room/[id]/room-client.tsx",
    "src/hooks/use-interview-livekit-room.ts",
    "src/app/interviewer/lobby/[id]/lobby-client.tsx",
    "src/components/interview/video-track.tsx",
  ];
  for (const file of clientSources) {
    const src = read(file);
    assert(!src.includes("LIVEKIT_API_SECRET"), `${file} does not expose API secret`);
    assert(!src.includes("LIVEKIT_API_KEY"), `${file} does not expose API key`);
  }

  const roomPage = read("src/app/interviewer/room/[id]/page.tsx");
  assert(
    !roomPage.includes("startOwnedInterview"),
    "interview start deferred until room connection",
  );

  const actions = read("src/lib/actions/interviewer.ts");
  assert(actions.includes("startInterviewAction"), "start interview action exists");
}

function unitChecks() {
  const interviewId = "507f1f77bcf86cd799439011";
  assert(
    getInterviewRoomName(interviewId) === `interview:${interviewId}`,
    "room name is deterministic from interview id",
  );
  assert(
    getParticipantIdentity("abc123") === "user:abc123",
    "participant identity is server-derived format",
  );

  const ttl = computeInterviewTokenTtlSeconds(45);
  assert(ttl >= 45 * 60, "token ttl includes interview duration");
  assert(ttl <= 4 * 60 * 60, "token ttl capped at four hours");
}

async function dbChecks() {
  await connectDB();

  const kabir = await User.findOne({ email: "kabir@codeshield.ai" }).lean();
  const riya = await User.findOne({ email: "riya@codeshield.ai" }).lean();
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();
  const demo = await User.findOne({ email: "demo@codeshield.ai" }).lean();
  const admin = await User.findOne({ email: "admin@codeshield.ai" }).lean();

  assert(kabir?._id && riya?._id && rohan?._id && demo?._id && admin?._id, "seed users exist");

  const scheduled = await Interview.findOne({
    interviewerId: kabir!._id,
    candidateId: rohan!._id,
    status: "scheduled",
  }).lean();

  let interviewId = scheduled?._id.toString();
  if (!interviewId) {
    const created = await Interview.create({
      candidateId: rohan!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 15 Video Verification",
      type: "Technical",
      scheduledAt: new Date(Date.now() + 86400000),
      durationMin: 45,
      status: "scheduled",
      meetingUrl: null,
    });
    interviewId = created._id.toString();
  }

  const studentAccess = await authorizeInterviewRoomAccess(
    interviewId,
    rohan!._id.toString(),
    "student",
    "Rohan Sharma",
  );
  assert(studentAccess?.participantRole === "student", "student authorized for own interview");

  const interviewerAccess = await authorizeInterviewRoomAccess(
    interviewId,
    kabir!._id.toString(),
    "interviewer",
    "Kabir Mehta",
  );
  assert(
    interviewerAccess?.participantRole === "interviewer",
    "interviewer authorized for assigned interview",
  );

  const foreignStudent = await authorizeInterviewRoomAccess(
    interviewId,
    demo!._id.toString(),
    "student",
    "Demo Student",
  );
  assert(foreignStudent === null, "foreign student rejected");

  const foreignInterviewer = await authorizeInterviewRoomAccess(
    interviewId,
    riya!._id.toString(),
    "interviewer",
    "Riya Shah",
  );
  assert(foreignInterviewer === null, "foreign interviewer rejected");

  const malformed = await authorizeInterviewRoomAccess(
    "not-valid",
    rohan!._id.toString(),
    "student",
    "Rohan",
  );
  assert(malformed === null, "malformed interview id rejected");

  const cancelled = await Interview.create({
    candidateId: rohan!._id,
    interviewerId: kabir!._id,
    createdBy: admin!._id,
    title: "Phase 15 Cancelled Video Test",
    type: "HR",
    scheduledAt: new Date(Date.now() + 86400000),
    durationMin: 30,
    status: "cancelled",
    meetingUrl: null,
  });

  const cancelledAccess = await authorizeInterviewRoomAccess(
    cancelled._id.toString(),
    rohan!._id.toString(),
    "student",
    "Rohan",
  );
  assert(cancelledAccess === null, "cancelled interview rejected for token");

  const completed = await Interview.create({
    candidateId: rohan!._id,
    interviewerId: kabir!._id,
    createdBy: admin!._id,
    title: "Phase 15 Completed Video Test",
    type: "HR",
    scheduledAt: new Date(Date.now() - 86400000),
    durationMin: 30,
    status: "completed",
    meetingUrl: null,
  });

  const completedAccess = await authorizeInterviewRoomAccess(
    completed._id.toString(),
    kabir!._id.toString(),
    "interviewer",
    "Kabir",
  );
  assert(completedAccess === null, "completed interview rejected for token");

  assert(isInterviewJoinable("scheduled"), "scheduled remains joinable");
  assert(!isInterviewJoinable("cancelled"), "cancelled not joinable");

  if (isLiveKitConfigured()) {
    const token = await createInterviewRoomToken({
      interviewId,
      userId: kabir!._id.toString(),
      role: "interviewer",
      displayName: "Kabir Mehta",
      durationMin: 45,
    });
    assert(token.roomName === getInterviewRoomName(interviewId), "token bound to interview room");
    assert(token.identity === getParticipantIdentity(kabir!._id.toString()), "token identity derived from user id");
    assert(token.token.includes("."), "token looks like JWT");
    console.log("OK: LiveKit token issued when configured");
  } else {
    console.log("SKIP: LiveKit env not configured — token issuance tested only when LIVEKIT_* set");
  }

  await Interview.deleteOne({ _id: cancelled._id });
  await Interview.deleteOne({ _id: completed._id });
}

async function main() {
  console.log("Phase 15 video interview verification\n");
  await staticChecks();
  unitChecks();
  await dbChecks();
  console.log("\nPASS: Phase 15 video interview checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
