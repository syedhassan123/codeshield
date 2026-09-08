"use server";

import { ActionError, requireInterviewer } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import {
  getInterviewerDashboardMetrics,
  getInterviewerCandidate,
  getInterviewForParticipant,
  getOwnedInterview,
  listInterviewerCandidateInterviews,
  listInterviewerCandidates,
  listInterviewerInterviews,
} from "@/lib/interviewer/queries";

export async function loadInterviewerDashboardAction() {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "DASHBOARD",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireInterviewer();
    op.auth(session.user);
    op.allowed("interviewer dashboard");
    await connectDB();

    const metrics = await getInterviewerDashboardMetrics(session.user.id);
    return op.respond(metrics);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function loadInterviewerInterviewsAction() {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "LIST",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireInterviewer();
    op.auth(session.user);
    op.allowed("interviewer list interviews");
    await connectDB();

    const interviews = await listInterviewerInterviews(session.user.id);
    return op.respond(interviews);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function loadInterviewerInterviewAction(interviewId: string) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "GET",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireInterviewer();
    op.auth(session.user);
    op.allowed("interviewer get interview");
    await connectDB();

    const interview = await getOwnedInterview(interviewId, session.user.id);
    if (!interview) {
      throw new ActionError("Interview not found.");
    }

    return op.respond(interview);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function loadInterviewForParticipantAction(interviewId: string) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "GET_PARTICIPANT",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireInterviewer();
    op.auth(session.user);
    op.allowed("interviewer participant interview");
    await connectDB();

    const interview = await getInterviewForParticipant(
      interviewId,
      session.user.id,
      session.user.role,
    );
    if (!interview) {
      throw new ActionError("Interview not found.");
    }

    return op.respond(interview);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function loadInterviewerCandidatesAction() {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "LIST_CANDIDATES",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireInterviewer();
    op.auth(session.user);
    op.allowed("interviewer list candidates");
    await connectDB();

    const candidates = await listInterviewerCandidates(session.user.id);
    return op.respond(candidates);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function loadInterviewerCandidateAction(candidateId: string) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "GET_CANDIDATE",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireInterviewer();
    op.auth(session.user);
    op.allowed("interviewer get candidate");
    await connectDB();

    const candidate = await getInterviewerCandidate(
      candidateId,
      session.user.id,
    );
    if (!candidate) {
      throw new ActionError("Candidate not found.");
    }

    return op.respond(candidate);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function loadInterviewerCandidateInterviewsAction(
  candidateId: string,
) {
  const op = createServerOp({
    domain: "INTERVIEW",
    operation: "LIST_CANDIDATE_INTERVIEWS",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireInterviewer();
    op.auth(session.user);
    op.allowed("interviewer list candidate interviews");
    await connectDB();

    const candidate = await getInterviewerCandidate(
      candidateId,
      session.user.id,
    );
    if (!candidate) {
      throw new ActionError("Candidate not found.");
    }

    const interviews = await listInterviewerCandidateInterviews(
      candidateId,
      session.user.id,
    );

    return op.respond(interviews);
  } catch (error) {
    return op.respondError(error);
  }
}
