import mongoose from "mongoose";
import { debugLog } from "@/lib/debug";
import { formatInterviewDateTime } from "@/lib/interviewer/format";
import { createNotification } from "@/lib/notifications/create";
import { InterviewEvaluation } from "@/models/InterviewEvaluation";
import { User } from "@/models/User";

/** Named, typed wrappers so every call site is self-documenting about
 * exactly which real event triggered the notification. */

const STUDENT_INTERVIEWS = "/student/interviews";
const INTERVIEWER_INTERVIEWS = "/interviewer/interviews";
const STUDENT_ASSESSMENTS = "/student/assessments";

export function newlyAssignedStudentIds(previous: string[], next: string[]) {
  const prev = new Set(previous);
  return [...new Set(next.filter((id) => id && !prev.has(id)))];
}

export function interviewScheduleChanged(
  previous: {
    candidateId: string;
    interviewerId: string;
    scheduledAt: Date;
    durationMin: number;
  },
  next: {
    candidateId: string;
    interviewerId: string;
    scheduledAt: Date;
    durationMin: number;
  },
) {
  return (
    previous.candidateId !== next.candidateId ||
    previous.interviewerId !== next.interviewerId ||
    previous.durationMin !== next.durationMin ||
    previous.scheduledAt.getTime() !== next.scheduledAt.getTime()
  );
}

function whenLabel(scheduledAt: Date) {
  return formatInterviewDateTime(scheduledAt);
}

function changeToken(parts: {
  scheduledAt: Date;
  durationMin: number;
  candidateId: string;
  interviewerId: string;
}) {
  return `${parts.scheduledAt.toISOString()}|${parts.durationMin}|${parts.candidateId}|${parts.interviewerId}`;
}

export function interviewReminderDedupeKey(
  interviewId: string,
  userId: string,
  scheduledAt: Date,
) {
  return `interview:${interviewId}:reminder:${userId}:${scheduledAt.toISOString()}`;
}

export function assessmentReminderDedupeKey(
  assessmentId: string,
  studentId: string,
  scheduledAt: Date,
) {
  return `assessment:${assessmentId}:reminder:${studentId}:${scheduledAt.toISOString()}`;
}

async function loadActiveUser(userId: mongoose.Types.ObjectId | string) {
  try {
    const id = String(userId);
    if (!mongoose.Types.ObjectId.isValid(id)) return null;
    const user = await User.findById(id).select("name status").lean();
    if (!user || user.status !== "active") return null;
    return { name: user.name?.trim() || "the candidate" };
  } catch {
    return null;
  }
}

async function safely(type: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    debugLog("NOTIFICATION", "CREATE_FAILED", {
      type,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function notifyCertificateIssued(params: {
  studentId: mongoose.Types.ObjectId;
  certificateId: string;
  assessmentTitle: string;
}) {
  await createNotification({
    userId: params.studentId,
    type: "CERTIFICATE_ISSUED",
    title: "Certificate issued",
    message: `You've earned a certificate for "${params.assessmentTitle}".`,
    link: `/student/certificates/${params.certificateId}`,
  });
}

export async function notifyCertificateRevoked(params: {
  studentId: mongoose.Types.ObjectId;
  assessmentTitle: string;
}) {
  await createNotification({
    userId: params.studentId,
    type: "CERTIFICATE_REVOKED",
    title: "Certificate revoked",
    message: `Your certificate for "${params.assessmentTitle}" has been revoked.`,
    link: `/student/certificates`,
  });
}

export async function notifyResultReady(params: {
  studentId: mongoose.Types.ObjectId;
  attemptId: string;
  assessmentTitle: string;
}) {
  await createNotification({
    userId: params.studentId,
    type: "RESULT_READY",
    title: "Result ready",
    message: `Your result for "${params.assessmentTitle}" is ready.`,
    link: `/student/exam/result/${params.attemptId}`,
  });
}

export async function notifyInterviewScheduled(params: {
  candidateId: mongoose.Types.ObjectId | string;
  interviewerId: mongoose.Types.ObjectId | string;
  interviewTitle: string;
  interviewId?: string;
  scheduledAt?: Date;
  candidateName?: string;
}) {
  await safely("INTERVIEW_SCHEDULED", async () => {
    const when = params.scheduledAt ? whenLabel(params.scheduledAt) : null;
    const candidate =
      params.candidateName ??
      (await loadActiveUser(params.candidateId))?.name ??
      "the candidate";
    const student = await loadActiveUser(params.candidateId);
    const interviewer = await loadActiveUser(params.interviewerId);
    const interviewId = params.interviewId;

    if (student) {
      await createNotification({
        userId: params.candidateId,
        type: "INTERVIEW_SCHEDULED",
        title: "Interview scheduled",
        message: when
          ? `Your ${params.interviewTitle} interview is scheduled for ${when}.`
          : `You have an interview scheduled: "${params.interviewTitle}".`,
        link: STUDENT_INTERVIEWS,
        dedupeKey: interviewId
          ? `interview:${interviewId}:scheduled:${String(params.candidateId)}`
          : undefined,
      });
    }

    if (interviewer) {
      await createNotification({
        userId: params.interviewerId,
        type: "INTERVIEW_SCHEDULED",
        title: "New interview assigned",
        message: when
          ? `You have been assigned a ${params.interviewTitle} interview with ${candidate}.`
          : `You've been assigned to conduct: "${params.interviewTitle}".`,
        link: INTERVIEWER_INTERVIEWS,
        dedupeKey: interviewId
          ? `interview:${interviewId}:scheduled:${String(params.interviewerId)}`
          : undefined,
      });
    }
  });
}

export async function notifyInterviewRescheduled(params: {
  interviewId: string;
  interviewTitle: string;
  scheduledAt: Date;
  durationMin: number;
  previous: {
    candidateId: string;
    interviewerId: string;
  };
  candidateId: string;
  interviewerId: string;
}) {
  await safely("INTERVIEW_RESCHEDULED", async () => {
    const when = whenLabel(params.scheduledAt);
    const token = changeToken({
      scheduledAt: params.scheduledAt,
      durationMin: params.durationMin,
      candidateId: params.candidateId,
      interviewerId: params.interviewerId,
    });
    const candidateChanged = params.previous.candidateId !== params.candidateId;
    const interviewerChanged =
      params.previous.interviewerId !== params.interviewerId;
    const candidate = await loadActiveUser(params.candidateId);
    const interviewer = await loadActiveUser(params.interviewerId);
    const candidateName = candidate?.name ?? "the candidate";

    if (candidate) {
      const assigned = candidateChanged;
      await createNotification({
        userId: params.candidateId,
        type: assigned ? "INTERVIEW_SCHEDULED" : "INTERVIEW_RESCHEDULED",
        title: assigned ? "Interview scheduled" : "Interview rescheduled",
        message: assigned
          ? `Your ${params.interviewTitle} interview is scheduled for ${when}.`
          : `Your ${params.interviewTitle} interview is now scheduled for ${when}.`,
        link: STUDENT_INTERVIEWS,
        dedupeKey: `interview:${params.interviewId}:${assigned ? "scheduled" : "rescheduled"}:${params.candidateId}:${token}`,
      });
    }

    if (interviewer) {
      const assigned = interviewerChanged;
      await createNotification({
        userId: params.interviewerId,
        type: assigned ? "INTERVIEW_SCHEDULED" : "INTERVIEW_RESCHEDULED",
        title: assigned ? "New interview assigned" : "Interview rescheduled",
        message: assigned
          ? `You have been assigned a ${params.interviewTitle} interview with ${candidateName}.`
          : `Your ${params.interviewTitle} interview with ${candidateName} is now scheduled for ${when}.`,
        link: INTERVIEWER_INTERVIEWS,
        dedupeKey: `interview:${params.interviewId}:${assigned ? "scheduled" : "rescheduled"}:${params.interviewerId}:${token}`,
      });
    }
  });
}

export async function notifyInterviewCancelled(params: {
  interviewId: string;
  interviewTitle: string;
  scheduledAt: Date;
  candidateId: mongoose.Types.ObjectId | string;
  interviewerId: mongoose.Types.ObjectId | string;
}) {
  await safely("INTERVIEW_CANCELLED", async () => {
    const when = whenLabel(params.scheduledAt);
    const candidate = await loadActiveUser(params.candidateId);
    const interviewer = await loadActiveUser(params.interviewerId);
    const candidateName = candidate?.name ?? "the candidate";

    if (candidate) {
      await createNotification({
        userId: params.candidateId,
        type: "INTERVIEW_CANCELLED",
        title: "Interview cancelled",
        message: `Your interview scheduled for ${when} has been cancelled.`,
        link: STUDENT_INTERVIEWS,
        dedupeKey: `interview:${params.interviewId}:cancelled:${String(params.candidateId)}`,
      });
    }

    if (interviewer) {
      await createNotification({
        userId: params.interviewerId,
        type: "INTERVIEW_CANCELLED",
        title: "Interview cancelled",
        message: `The ${params.interviewTitle} interview with ${candidateName} scheduled for ${when} has been cancelled.`,
        link: INTERVIEWER_INTERVIEWS,
        dedupeKey: `interview:${params.interviewId}:cancelled:${String(params.interviewerId)}`,
      });
    }
  });
}

export function interviewEvaluationPendingDedupeKey(
  interviewId: string,
  interviewerId: string,
) {
  return `interview:${interviewId}:evaluation-pending:${interviewerId}`;
}

export async function notifyInterviewReminder(params: {
  interviewId: string;
  interviewTitle: string;
  scheduledAt: Date;
  candidateId: mongoose.Types.ObjectId | string;
  interviewerId: mongoose.Types.ObjectId | string;
  /** Minutes before start. Callers pass INTERVIEW_REMINDER_LEAD_MS. */
  leadMinutes?: number;
}) {
  await safely("INTERVIEW_REMINDER", async () => {
    const when = whenLabel(params.scheduledAt);
    const lead = params.leadMinutes ?? 30;
    const candidate = await loadActiveUser(params.candidateId);
    const interviewer = await loadActiveUser(params.interviewerId);
    const candidateName = candidate?.name ?? "the candidate";

    if (candidate) {
      await createNotification({
        userId: params.candidateId,
        type: "INTERVIEW_REMINDER",
        title: "Interview starting soon",
        message: `Your ${params.interviewTitle} interview begins in ${lead} minutes (${when}).`,
        link: STUDENT_INTERVIEWS,
        dedupeKey: interviewReminderDedupeKey(
          params.interviewId,
          String(params.candidateId),
          params.scheduledAt,
        ),
      });
    }

    if (interviewer) {
      await createNotification({
        userId: params.interviewerId,
        type: "INTERVIEW_REMINDER",
        title: "Interview starting soon",
        message: `Your ${params.interviewTitle} interview with ${candidateName} begins in ${lead} minutes (${when}).`,
        link: INTERVIEWER_INTERVIEWS,
        dedupeKey: interviewReminderDedupeKey(
          params.interviewId,
          String(params.interviewerId),
          params.scheduledAt,
        ),
      });
    }
  });
}

/**
 * One notice for the assigned interviewer after a real completion, and only
 * when no evaluation document exists yet. Repeats are the same dedupe key.
 */
export async function notifyInterviewEvaluationPending(params: {
  interviewId: string;
  interviewTitle: string;
  interviewerId: mongoose.Types.ObjectId | string;
}) {
  await safely("INTERVIEW_EVALUATION_PENDING", async () => {
    const interviewerId = String(params.interviewerId);
    const interviewer = await loadActiveUser(interviewerId);
    if (!interviewer) return;
    if (!mongoose.Types.ObjectId.isValid(params.interviewId)) return;
    const existing = await InterviewEvaluation.exists({
      interviewId: params.interviewId,
    });
    if (existing) return;
    await createNotification({
      userId: interviewerId,
      type: "INTERVIEW_EVALUATION_PENDING",
      title: "Evaluation pending",
      message: `Complete the evaluation for ${params.interviewTitle}.`,
      link: `/interviewer/evaluations/${params.interviewId}`,
      dedupeKey: interviewEvaluationPendingDedupeKey(
        params.interviewId,
        interviewerId,
      ),
    });
  });
}

export async function notifyAssessmentAssigned(params: {
  assessmentId: string;
  assessmentTitle: string;
  studentIds: string[];
}) {
  await safely("ASSESSMENT_ASSIGNED", async () => {
    const ids = [...new Set(params.studentIds.filter(Boolean))];
    await Promise.all(
      ids.map(async (studentId) => {
        const student = await loadActiveUser(studentId);
        if (!student) return;
        await createNotification({
          userId: studentId,
          type: "ASSESSMENT_ASSIGNED",
          title: "Assessment assigned",
          message: `${params.assessmentTitle} is now available.`,
          link: STUDENT_ASSESSMENTS,
          dedupeKey: `assessment:${params.assessmentId}:assigned:${studentId}`,
        });
      }),
    );
  });
}

export async function notifyAssessmentReminder(params: {
  assessmentId: string;
  assessmentTitle: string;
  scheduledAt: Date;
  studentId: string;
}) {
  await safely("ASSESSMENT_REMINDER", async () => {
    const student = await loadActiveUser(params.studentId);
    if (!student) return;
    await createNotification({
      userId: params.studentId,
      type: "ASSESSMENT_REMINDER",
      title: "Assessment reminder",
      message: `${params.assessmentTitle} starts at ${whenLabel(params.scheduledAt)}.`,
      link: STUDENT_ASSESSMENTS,
      dedupeKey: assessmentReminderDedupeKey(
        params.assessmentId,
        params.studentId,
        params.scheduledAt,
      ),
    });
  });
}
