import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authorizeInterviewRoomAccess } from "@/lib/interviewer/room-access";
import { isLiveKitConfigured } from "@/lib/livekit/config";
import { createInterviewRoomToken } from "@/lib/livekit/room";
import { createServerOp } from "@/lib/debug";

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: interviewId } = await context.params;
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "ROOM_TOKEN",
    source: "API",
  });

  try {
    const session = await auth();
    if (!session?.user?.id || !session.user.role) {
      op.denied("room token unauthenticated");
      return NextResponse.json({ error: "Interview not available." }, { status: 404 });
    }

    op.auth(session.user);

    if (!isLiveKitConfigured()) {
      return NextResponse.json(
        { error: "Video interview service is not configured." },
        { status: 503 },
      );
    }

    const access = await authorizeInterviewRoomAccess(
      interviewId,
      session.user.id,
      session.user.role,
      session.user.name || "Participant",
    );

    if (!access) {
      op.denied("room token unauthorized");
      return NextResponse.json({ error: "Interview not available." }, { status: 404 });
    }

    op.allowed("issue interview room token");

    const credentials = await createInterviewRoomToken({
      interviewId: access.interviewId,
      userId: session.user.id,
      role: access.participantRole,
      displayName: access.displayName,
      durationMin: access.durationMin,
    });

    return NextResponse.json({
      token: credentials.token,
      url: credentials.url,
      roomName: credentials.roomName,
      identity: credentials.identity,
      participantRole: access.participantRole,
    });
  } catch (error) {
    op.respondError(error);
    return NextResponse.json(
      { error: "Unable to connect to interview room." },
      { status: 500 },
    );
  }
}
