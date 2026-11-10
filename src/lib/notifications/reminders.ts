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
/**
 * Grace after the reminder due time (scheduledAt - lead), not after start.
 * Example: interview at 8:00, lead 30m → dueAt 7:30 → eligible 7:30–7:35.
 * Matches the 5-minute scheduler cadence so one missed tick can still fire
 * before the interview starts. Never reminds once scheduledAt has passed.
 */
export const REMINDER_TOLERANCE_MS = 5 * 60 * 1000;

const INTERVIEW_SWEEP_LIMIT = 100;
const ASSESSMENT_SWEEP_LIMIT = 50;

/**
 * dueAt = scheduledAt - leadMs.
 * Eligible while dueAt <= now <= dueAt + grace, and only if scheduledAt > now.
 */
export function isDueForReminder(
  scheduledAt: Date,
  now: Date,
  leadMs: number,
  toleranceMs = REMINDER_TOLERANCE_MS,
) {
  const start = scheduledAt.getTime();
  const current = now.getTime();
  if (Number.isNaN(start) || Number.isNaN(current)) return false;
  if (start <= current) return false;
  const dueAt = start - leadMs;
  return current >= dueAt && current <= dueAt + toleranceMs;
}

/** Mongo range matching isDueForReminder for a sweep at `now`. */
export function reminderScheduledAtBounds(
  now: Date,
  leadMs: number,
  toleranceMs = REMINDER_TOLERANCE_MS,
) {
  return {
    from: new Date(now.getTime() + leadMs - toleranceMs),
    to: new Date(now.getTime() + leadMs),
  };
}

/**
 * Idempotent reminder sweep — the single production reminder engine.
 *
 * Callers:
 * - POST /api/cron/notification-reminders (external scheduler every 5 min)
 * - scripts/run-notification-reminders.ts (local / support QA)
 *
 * The header bell does not call this. Repeated and overlapping runs insert
 * nothing new: each reminder uses a stable MongoDB dedupeKey.
 * Cancelled and completed interviews are excluded by status. Students who
 * already submitted or expired an attempt are skipped.
 *
 * Eligibility (interview example: lead 30m, grace 5m):
 *   dueAt = scheduledAt - 30m
 *   remind only while now ∈ [dueAt, dueAt + 5m]
 *   never when scheduledAt <= now
 * Query form: scheduledAt ∈ [now + lead - grace, now + lead]
 */
export async function processDueReminders(now = new Date()) {
  const interviewBounds = reminderScheduledAtBounds(
    now,
    INTERVIEW_REMINDER_LEAD_MS,
  );
  const interviews = await Interview.find({
    status: "scheduled",
    scheduledAt: {
      $gte: interviewBounds.from,
      $lte: interviewBounds.to,
    },
  })
    .select("candidateId interviewerId title scheduledAt")
    .sort({ scheduledAt: 1 })
    .limit(INTERVIEW_SWEEP_LIMIT)
    .lean();

  for (const interview of interviews) {
    if (
      !isDueForReminder(
        interview.scheduledAt,
        now,
        INTERVIEW_REMINDER_LEAD_MS,
      )
    ) {
      continue;
    }
    await notifyInterviewReminder({
      interviewId: interview._id.toString(),
      interviewTitle: interview.title,
      scheduledAt: interview.scheduledAt,
      candidateId: interview.candidateId,
      interviewerId: interview.interviewerId,
      leadMinutes: INTERVIEW_REMINDER_LEAD_MS / (60 * 1000),
    });
  }

  const assessmentBounds = reminderScheduledAtBounds(
    now,
    ASSESSMENT_REMINDER_LEAD_MS,
  );
  const assessments = await Assessment.find({
    status: { $in: ["scheduled", "published"] },
    scheduledAt: {
      $gte: assessmentBounds.from,
      $lte: assessmentBounds.to,
    },
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
    if (
      !isDueForReminder(
        assessment.scheduledAt,
        now,
        ASSESSMENT_REMINDER_LEAD_MS,
      )
    ) {
      continue;
    }
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
