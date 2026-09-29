/**
 * Phase 24: live LiveKit interview room + InterviewRecording.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase24-livekit-interview.ts
 */
import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  finalizeInterviewRecordingOnEnd,
  getInterviewRecordingForViewer,
  interviewRecordingNotFoundBody,
  reconcileInterviewRecording,
  startOwnedInterviewRecording,
} from "../src/lib/interview-recording/service";
import { isLiveKitConfigured } from "../src/lib/livekit/config";
import {
  createInterviewEgressClient,
  createInterviewRoomServiceClient,
  isInterviewEgressConfigured,
  buildInterviewEgressFileOutput,
} from "../src/lib/livekit/egress";
import {
  computeInterviewTokenTtlSeconds,
  getInterviewRoomName,
  INTERVIEW_ROOM_TOKEN_TTL_SECONDS,
} from "../src/lib/livekit/room";
import { buildInterviewRecordingObjectKey } from "../src/lib/storage";
import { Interview } from "../src/models/Interview";
import { InterviewRecording } from "../src/models/InterviewRecording";
import { User } from "../src/models/User";
import { INTERVIEW_RECORDING_NOT_FOUND } from "../src/types/interview-recording";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

function staticChecks() {
  const clientFiles = [
    "src/app/interviewer/room/[id]/room-client.tsx",
    "src/hooks/use-interview-livekit-room.ts",
    "src/hooks/use-interview-recording.ts",
    "src/app/interviewer/lobby/[id]/lobby-client.tsx",
    "src/components/interview/video-track.tsx",
    "src/app/interviewer/(portal)/evaluations/[interviewId]/evaluation-form-client.tsx",
  ];
  for (const file of clientFiles) {
    const src = read(file);
    assert(!src.includes("LIVEKIT_API_SECRET"), `${file} does not use API secret`);
    assert(!src.includes("LIVEKIT_API_KEY"), `${file} does not use API key`);
    assert(!src.includes("NEXT_PUBLIC_LIVEKIT"), `${file} has no NEXT_PUBLIC LiveKit secret`);
  }

  const tokenRoute = read("src/app/api/interviews/[id]/room-token/route.ts");
  assert(
    tokenRoute.includes("authorizeInterviewRoomAccess"),
    "token route still enforces ownership",
  );
  assert(
    tokenRoute.includes("createInterviewRoomToken"),
    "token route uses server-derived room credentials",
  );
  assert(
    !tokenRoute.includes("req.json") && !tokenRoute.includes("request.json"),
    "token route does not take a room name from the body",
  );

  const roomTs = read("src/lib/livekit/room.ts");
  assert(
    roomTs.includes("INTERVIEW_ROOM_TOKEN_TTL_SECONDS = 15 * 60") ||
      INTERVIEW_ROOM_TOKEN_TTL_SECONDS === 15 * 60,
    "room JWT TTL is 15 minutes",
  );
  assert(
    computeInterviewTokenTtlSeconds(180) === 15 * 60,
    "long interviews still issue a 15-minute JWT",
  );
  assert(
    roomTs.includes("interview:${") || roomTs.includes("`interview:"),
    "room name stays interview:{id}",
  );
  assert(roomTs.includes("roomJoin: true"), "JWT grant includes roomJoin");
  assert(roomTs.includes("canPublish: true"), "JWT grant includes canPublish");
  assert(roomTs.includes("canSubscribe: true"), "JWT grant includes canSubscribe");

  const roomClient = read("src/app/interviewer/room/[id]/room-client.tsx");
  assert(
    roomClient.includes("if (!livekitConfigured)"),
    "unconfigured early-return remains for missing keys",
  );
  assert(
    roomClient.includes("ConnectionState.Connected"),
    "start path is gated on connected state",
  );
  assert(
    roomClient.includes("startedRef"),
    "startInterviewAction is guarded against reconnect re-entry",
  );
  assert(
    roomClient.includes("startedRef.current = true"),
    "start + recording run only once per room mount",
  );
  assert(
    !roomClient.includes("startedRef.current = false"),
    "startedRef is never cleared on reconnect",
  );
  assert(
    roomClient.includes("startInterviewRecordingAction"),
    "recording starts after the interviewer connects",
  );
  assert(roomClient.includes("Retry"), "connection errors expose Retry");
  assert(
    roomClient.includes('recordingMode === "client"'),
    "MediaRecorder is gated on client fallback mode",
  );
  assert(
    roomClient.includes('mode "egress"') &&
      roomClient.includes("never enables this hook"),
    "MediaRecorder does not run after successful egress",
  );

  const hook = read("src/hooks/use-interview-livekit-room.ts");
  assert(
    hook.includes("classifyInterviewRoomError"),
    "LiveKit hook classifies connection errors",
  );
  assert(hook.includes("Token fetch failed"), "token fetch errors are specific");
  assert(hook.includes("not authorized"), "authorization errors are specific");
  assert(hook.includes("LiveKit is unreachable"), "unreachable errors are specific");
  assert(
    hook.includes("permission was denied"),
    "camera/mic permission errors are specific",
  );
  assert(
    hook.includes("fetchInterviewRoomToken"),
    "hook fetches a room token function",
  );
  assert(
    hook.includes("RoomEvent.Disconnected"),
    "hook refreshes the token on reconnect",
  );
  assert(
    (hook.match(/fetchInterviewRoomToken/g) || []).length >= 2,
    "reconnect path fetches a fresh token, not the expired JWT",
  );
  assert(
    !hook.includes("startInterviewAction") &&
      !hook.includes("startInterviewRecordingAction"),
    "reconnect never re-calls startInterviewAction or creates a recording",
  );
  assert(
    hook.includes("MAX_AUTO_RECONNECTS = 3"),
    "automatic reconnects are capped at 3",
  );
  assert(
    hook.includes("reconnectBackoffMs"),
    "automatic reconnects use backoff",
  );
  assert(
    hook.includes("DisconnectReason.CLIENT_INITIATED") &&
      hook.includes("intentionalDisconnectRef"),
    "intentional leave / End Interview does not refetch a token",
  );
  assert(
    hook.includes("DisconnectReason.ROOM_DELETED") &&
      hook.includes("DisconnectReason.PARTICIPANT_REMOVED") &&
      hook.includes("DisconnectReason.DUPLICATE_IDENTITY"),
    "terminal disconnect reasons skip auto-reconnect",
  );

  const recordingService = read("src/lib/interview-recording/service.ts");
  assert(
    recordingService.includes("startRoomCompositeEgress"),
    "recording prefers LiveKit egress",
  );
  assert(
    recordingService.includes("RECORDING_EGRESS_FALLBACK"),
    "egress failure falls back to client recording",
  );
  assert(
    recordingService.includes("doc.errorMessage = reason") ||
      recordingService.includes("errorMessage = reason"),
    "egress failure reason is stored on the recording row",
  );
  const fallbackIdx = recordingService.indexOf("RECORDING_EGRESS_FALLBACK");
  const modeClientIdx = recordingService.indexOf('doc.mode = "client"');
  assert(
    fallbackIdx >= 0 && modeClientIdx > fallbackIdx,
    "client MediaRecorder mode is set only after egress fails",
  );

  const types = read("src/types/interview-recording.ts");
  assert(types.includes('"RECORDING"'), "status includes RECORDING");
  assert(types.includes('"UPLOADING"'), "status includes UPLOADING");
  assert(types.includes('"READY"'), "status includes READY");
  assert(types.includes('"FAILED"'), "status includes FAILED");

  const complete = read("src/lib/actions/interviewer.ts");
  assert(
    complete.includes("finalizeInterviewRecordingOnEnd"),
    "End Interview finalizes recording",
  );
  assert(
    complete.includes("completeOwnedInterview"),
    "End Interview still completes the interview",
  );
  const finalizeIdx = complete.indexOf("finalizeInterviewRecordingOnEnd");
  const completeIdx = complete.indexOf("completeOwnedInterview");
  assert(
    finalizeIdx >= 0 && completeIdx > finalizeIdx,
    "recording finalize runs before completeOwnedInterview",
  );
  assert(
    complete.includes("catch (recordingError)") ||
      complete.includes("catch (recordingError)"),
    "recording finalize is wrapped so End Interview cannot abort",
  );

  const model = read("src/models/InterviewRecording.ts");
  assert(
    model.includes('status: { $in: ["RECORDING", "UPLOADING"] }'),
    "partial unique index covers RECORDING and UPLOADING",
  );
}

async function dbChecks() {
  await connectDB();
  await InterviewRecording.syncIndexes();

  const kabir = await User.findOne({ email: "kabir@codeshield.ai" }).lean();
  const riya = await User.findOne({ email: "riya@codeshield.ai" }).lean();
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();
  const demo = await User.findOne({ email: "demo@codeshield.ai" }).lean();
  const admin = await User.findOne({ email: "admin@codeshield.ai" }).lean();
  assert(kabir && riya && rohan && demo && admin, "seed users exist");

  const interview = await Interview.create({
    candidateId: rohan!._id,
    interviewerId: kabir!._id,
    createdBy: admin!._id,
    title: "Phase 24 Recording Verification",
    type: "Technical",
    scheduledAt: new Date(),
    durationMin: 30,
    status: "in_progress",
    meetingUrl: null,
  });
  const interviewId = interview._id.toString();
  const missingId = new mongoose.Types.ObjectId().toString();

  const ownedStart = await startOwnedInterviewRecording(
    kabir!._id.toString(),
    interviewId,
  );
  assert(ownedStart.ok === true, "assigned interviewer can start recording");
  assert(ownedStart.ok && ownedStart.reused === false, "first start creates a row");
  if (ownedStart.ok && ownedStart.mode === "client") {
    const fallbackRow = await InterviewRecording.findById(ownedStart.recordingId);
    assert(
      Boolean(fallbackRow?.errorMessage),
      "client fallback stores the egress failure reason",
    );
  }

  const secondStart = await startOwnedInterviewRecording(
    kabir!._id.toString(),
    interviewId,
  );
  assert(secondStart.ok === true, "second start does not throw");
  assert(
    secondStart.ok &&
      ownedStart.ok &&
      secondStart.recordingId === ownedStart.recordingId &&
      secondStart.reused,
    "second start reuses the active recording",
  );

  const activeCount = await InterviewRecording.countDocuments({
    interviewId: interview._id,
    status: { $in: ["RECORDING", "UPLOADING"] },
  });
  assert(activeCount === 1, "only one active recording row exists");

  const foreignStart = await startOwnedInterviewRecording(
    riya!._id.toString(),
    interviewId,
  );
  const missingStart = await startOwnedInterviewRecording(
    kabir!._id.toString(),
    missingId,
  );
  assert(
    JSON.stringify(foreignStart) === JSON.stringify(missingStart),
    "missing and not-owned start responses are identical",
  );
  assert(
    !foreignStart.ok &&
      foreignStart.error === INTERVIEW_RECORDING_NOT_FOUND &&
      JSON.stringify(foreignStart) === JSON.stringify(interviewRecordingNotFoundBody()),
    "unauthorized start uses the shared not-found body",
  );

  const candidateStart = await startOwnedInterviewRecording(
    rohan!._id.toString(),
    interviewId,
  );
  assert(
    JSON.stringify(candidateStart) === JSON.stringify(missingStart),
    "candidate start matches missing-interview not-found",
  );

  const studentView = await getInterviewRecordingForViewer(
    rohan!._id.toString(),
    "student",
    interviewId,
  );
  const missingView = await getInterviewRecordingForViewer(
    kabir!._id.toString(),
    "interviewer",
    missingId,
  );
  const foreignView = await getInterviewRecordingForViewer(
    riya!._id.toString(),
    "interviewer",
    interviewId,
  );
  assert(
    JSON.stringify(studentView) === JSON.stringify(missingView),
    "student playback matches missing-interview not-found",
  );
  assert(
    JSON.stringify(foreignView) === JSON.stringify(missingView),
    "foreign interviewer playback matches missing-interview not-found",
  );
  assert(
    !studentView.ok && studentView.error === INTERVIEW_RECORDING_NOT_FOUND,
    "student cannot play the raw recording",
  );

  const recording = await InterviewRecording.findById(
    ownedStart.ok ? ownedStart.recordingId : null,
  );
  assert(recording, "recording row exists");
  recording!.status = "FAILED";
  recording!.mode = "client";
  recording!.storageProvider = "local";
  recording!.errorMessage = "timed out";
  recording!.endedAt = new Date();
  await recording!.save();

  const recordingsDir =
    process.env.RECORDINGS_DIR ||
    path.join(process.cwd(), ".data", "recordings");
  const fullPath = path.join(recordingsDir, recording!.storageKey);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, Buffer.from("phase24-reconcile"));

  const reconciled = await reconcileInterviewRecording(interviewId);
  assert(reconciled?.status === "READY", "FAILED can move to READY when the file exists");

  reconciled!.errorMessage = "should not stick";
  await reconcileInterviewRecording(interviewId);
  const after = await InterviewRecording.findById(recording!._id);
  assert(after?.status === "READY", "READY never regresses on reconcile");

  const finalizeReady = await finalizeInterviewRecordingOnEnd(
    kabir!._id.toString(),
    interviewId,
  );
  assert(
    finalizeReady.ok && finalizeReady.status === "READY",
    "finalize leaves READY recordings alone",
  );

  const interviewerView = await getInterviewRecordingForViewer(
    kabir!._id.toString(),
    "interviewer",
    interviewId,
  );
  assert(
    interviewerView.ok && interviewerView.status === "READY" && interviewerView.playbackUrl,
    "owning interviewer can play a READY recording",
  );
  assert(
    interviewerView.ok &&
      Boolean(interviewerView.playbackUrl) &&
      !interviewerView.playbackUrl!.includes(recording!.storageKey),
    "playback URL does not leak the raw storage key",
  );

  const adminView = await getInterviewRecordingForViewer(
    admin!._id.toString(),
    "admin",
    interviewId,
  );
  assert(
    adminView.ok && adminView.status === "READY" && adminView.playbackUrl,
    "admin can play a READY recording",
  );

  const foreignFinalize = await finalizeInterviewRecordingOnEnd(
    riya!._id.toString(),
    interviewId,
  );
  const missingFinalize = await finalizeInterviewRecordingOnEnd(
    kabir!._id.toString(),
    missingId,
  );
  assert(
    JSON.stringify(foreignFinalize) === JSON.stringify(missingFinalize),
    "missing and not-owned finalize responses are identical",
  );

  assert(
    getInterviewRoomName(interviewId) === `interview:${interviewId}`,
    "room name remains server-derived",
  );

  await InterviewRecording.deleteMany({ interviewId: interview._id });
  await Interview.deleteOne({ _id: interview._id });
  try {
    fs.unlinkSync(fullPath);
  } catch {
    // ignore
  }
}

async function liveEgressCheck(interviewIdArg?: string) {
  if (!isInterviewEgressConfigured()) {
    console.log(
      "SKIP: --live-egress needs LiveKit + S3 (S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY)",
    );
    return;
  }

  await connectDB();
  const kabir = await User.findOne({ email: "kabir@codeshield.ai" }).lean();
  const rohan = await User.findOne({ email: "rohan@codeshield.edu" }).lean();
  const admin = await User.findOne({ email: "admin@codeshield.ai" }).lean();
  assert(kabir && rohan && admin, "seed users exist for live egress");

  let interviewId = interviewIdArg;
  let created = false;
  if (!interviewId) {
    const createdInterview = await Interview.create({
      candidateId: rohan!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 24 Live Egress",
      type: "Technical",
      scheduledAt: new Date(),
      durationMin: 30,
      status: "in_progress",
      meetingUrl: null,
    });
    interviewId = createdInterview._id.toString();
    created = true;
  }

  const roomName = getInterviewRoomName(interviewId);
  const storageKey = buildInterviewRecordingObjectKey({
    interviewId,
    mimeType: "video/mp4",
  });
  const rooms = createInterviewRoomServiceClient();
  const egress = createInterviewEgressClient();

  await rooms.createRoom({ name: roomName, emptyTimeout: 120 });
  const participants = await rooms.listParticipants(roomName).catch(() => []);
  console.log(
    `INFO: live room ${roomName} participants=${participants.length}`,
  );

  let info;
  try {
    info = await egress.startRoomCompositeEgress(
      roomName,
      buildInterviewEgressFileOutput(storageKey),
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : "egress start failed";
    console.log(`INFO: live egress path=fallback reason=${reason}`);
    if (created) {
      await Interview.deleteOne({ _id: interviewId });
    }
    throw new Error(`FAIL: live egress did not start: ${reason}`);
  }

  console.log(
    [
      "INFO: live egress path=egress",
      `egressId=${info.egressId}`,
      `status=${info.status}`,
      `storageKey=${storageKey}`,
    ].join(" "),
  );

  try {
    await egress.stopEgress(info.egressId);
  } catch {
    // room may already be empty
  }

  if (created) {
    await Interview.deleteOne({ _id: interviewId });
  }
}

async function main() {
  const liveEgress = process.argv.includes("--live-egress");
  const interviewArg = process.argv
    .find((arg) => arg.startsWith("--interview-id="))
    ?.slice("--interview-id=".length);

  console.log("Phase 24 live LiveKit interview + recording verification\n");
  staticChecks();

  assert(isLiveKitConfigured(), "LIVEKIT_* is configured so the room path is live");
  console.log(
    isInterviewEgressConfigured()
      ? "INFO: egress+S3 configured — recording prefers LiveKit Egress"
      : "INFO: no egress output storage — recording uses interviewer MediaRecorder fallback",
  );

  await dbChecks();
  if (liveEgress) {
    await liveEgressCheck(interviewArg);
  }
  console.log("\nPASS: Phase 24 livekit interview checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
