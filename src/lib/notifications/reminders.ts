import { debugLog } from "@/lib/debug";
import {
  interviewReminderDedupeKey,
  notifyAssessmentReminder,
  notifyInterviewReminder,
} from "@/lib/notifications/events";
import { Assessment } from "@/models/Assessment";
import { Attempt } from "@/models/Attempt";
import { Interview } from "@/models/Interview";

/** 30 minutes before a scheduled interview. */
export const INTERVIEW_REMINDER_LEAD_MS = 30 * 60 * 1000;
/** 1 hour before a scheduled assessment start. */
export const ASSESSMENT_REMINDER_LEAD_MS = 60 * 60 * 1000;
/** Late sweeps still count if they land shortly after the lead boundary. */
export const REMINDER_TOLERANCE_MS = 5 * 60 * 1000;

const INTERVIEW_SWEEP_LIMIT = 100;
const ASSESSMENT_SWEEP_LIMIT = 50;

export function isDueForReminder(
  scheduledAt: Date,
  now: Date,
  leadMs: number,
  toleranceMs = REMINDER_TOLERANCE_MS,
) {
  const time = scheduledAt.getTime();
  if (Number.isNaN(time)) return false;
  return (
    time >= now.getTime() - toleranceMs && time <= now.getTime() + leadMs
  );
}

/**
 * Idempotent reminder sweep. There is no cron, queue, or worker in this
 * app, so a signed-in shell poll calls this. Repeated runs insert nothing
 * new: each reminder uses a stable dedupeKey. Cancelled and completed
 * interviews are excluded by status. Students who already submitted or
 * expired an attempt are skipped.
 */
export async function processDueReminders(now = new Date()) {
  const interviewFrom = new Date(now.getTime() - REMINDER_TOLERANCE_MS);
  const interviewTo = new Date(now.getTime() + INTERVIEW_REMINDER_LEAD_MS);
  const interviews = await Interview.find({
    status: "scheduled",
    scheduledAt: { $gte: interviewFrom, $lte: interviewTo },
  })
    .select("candidateId interviewerId title scheduledAt")
    .sort({ scheduledAt: 1 })
    .limit(INTERVIEW_SWEEP_LIMIT)
    .lean();

  for (const interview of interviews) {
    await notifyInterviewReminder({
      interviewId: interview._id.toString(),
      interviewTitle: interview.title,
      scheduledAt: interview.scheduledAt,
      candidateId: interview.candidateId,
      interviewerId: interview.interviewerId,
    });
  }

  const assessmentFrom = new Date(now.getTime() - REMINDER_TOLERANCE_MS);
  const assessmentTo = new Date(now.getTime() + ASSESSMENT_REMINDER_LEAD_MS);
  const assessments = await Assessment.find({
    status: { $in: ["scheduled", "published"] },
    scheduledAt: { $gte: assessmentFrom, $lte: assessmentTo },
    assignedStudentIds: { $exists: true, $ne: [] },
  })
    .select("title scheduledAt assignedStudentIds")
    .sort({ scheduledAt: 1 })
    .limit(ASSESSMENT_SWEEP_LIMIT)
    .lean();

  if (!assessments.length) {
    debugLog("NOTIFICATION", "REMINDER_SWEEP", {
      interviews: interviews.length,
      assessments: 0,
    });
    return { interviews: interviews.length, assessments: 0 };
  }

  const assessmentIds = assessments.map((item) => item._id);
  const studentIds = assessments.flatMap((item) => item.assignedStudentIds);
  const finished = await Attempt.find({
    assessmentId: { $in: assessmentIds },
    studentId: { $in: studentIds },
    status: { $in: ["submitted", "expired"] },
  })
    .select("assessmentId studentId")
    .lean();

  const finishedKeys = new Set(
    finished.map(
      (attempt) =>
        `${attempt.assessmentId.toString()}:${attempt.studentId.toString()}`,
    ),
  );

  let assessmentReminders = 0;
  for (const assessment of assessments) {
    if (!assessment.scheduledAt) continue;
    for (const studentId of assessment.assignedStudentIds) {
      const studentKey = studentId.toString();
      const pair = `${assessment._id.toString()}:${studentKey}`;
      if (finishedKeys.has(pair)) continue;
      assessmentReminders += 1;
      await notifyAssessmentReminder({
        assessmentId: assessment._id.toString(),
        assessmentTitle: assessment.title,
        scheduledAt: assessment.scheduledAt,
        studentId: studentKey,
      });
    }
  }

  debugLog("NOTIFICATION", "REMINDER_SWEEP", {
    interviews: interviews.length,
    assessments: assessmentReminders,
  });

  return { interviews: interviews.length, assessments: assessmentReminders };
}

export function reminderKeysForInterview(params: {
  interviewId: string;
  candidateId: string;
  interviewerId: string;
  scheduledAt: Date;
}) {
  return [
    interviewReminderDedupeKey(
      params.interviewId,
      params.candidateId,
      params.scheduledAt,
    ),
    interviewReminderDedupeKey(
      params.interviewId,
      params.interviewerId,
      params.scheduledAt,
    ),
  ];
}
