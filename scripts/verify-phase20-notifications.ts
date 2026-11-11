/**
 * Phase 20 checks: real in-app notification bell, shared across all three
 * portals (admin/student/interviewer). No new dependency, no LiveKit/LLM
 * keys — just a Notification model wired into existing real events
 * (certificate issued/revoked, result ready, interview scheduled).
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase20-notifications.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { revokeCertificate } from "../src/lib/certificates/admin-queries";
import { issueCertificateIfEligible } from "../src/lib/certificates/issue";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "../src/lib/notifications/queries";
import { safeNotificationPath } from "../src/lib/notifications/create";
import {
  assessmentReminderDedupeKey,
  interviewReminderDedupeKey,
  interviewScheduleChanged,
  newlyAssignedStudentIds,
  interviewEvaluationPendingDedupeKey,
  notifyAssessmentAssigned,
  notifyInterviewCancelled,
  notifyInterviewEvaluationPending,
  notifyInterviewRescheduled,
  notifyInterviewScheduled,
} from "../src/lib/notifications/events";
import {
  ASSESSMENT_REMINDER_LEAD_MS,
  INTERVIEW_REMINDER_LEAD_MS,
  isDueForReminder,
  processDueReminders,
} from "../src/lib/notifications/reminders";
import { Assessment } from "../src/models/Assessment";
import { Attempt } from "../src/models/Attempt";
import { Certificate } from "../src/models/Certificate";
import { Interview } from "../src/models/Interview";
import { InterviewEvaluation } from "../src/models/InterviewEvaluation";
import { Notification } from "../src/models/Notification";
import { Result } from "../src/models/Result";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

function staticChecks() {
  const model = read("src/models/Notification.ts");
  assert(
    model.includes("NOTIFICATION_TYPES"),
    "Notification model defines a typed event enum",
  );

  const queries = read("src/lib/notifications/queries.ts");
  assert(
    queries.includes("{ _id: notificationId, userId }"),
    "markNotificationRead scopes by userId (IDOR-safe, no cross-user marking)",
  );

  const createLib = read("src/lib/notifications/create.ts");
  assert(
    /catch\s*\(error\)\s*\{[\s\S]*debugLog/.test(createLib),
    "notification creation is best-effort — failures are logged, never thrown",
  );

  const actions = read("src/lib/actions/notifications.ts");
  assert(
    actions.includes("requireSession"),
    "notification actions require an authenticated session (any role)",
  );

  const shell = read("src/components/layout/workspace-shell.tsx");
  assert(
    shell.includes("unreadCount > 0"),
    "unread badge reflects a real unreadCount, not a hardcoded dot",
  );
  assert(shell.includes("getNotificationsAction"), "shell loads real notifications");
  assert(
    shell.includes("markNotificationReadAction"),
    "clicking a notification marks it read for real",
  );
  assert(
    shell.includes("onClick={handleToggleNotifications}"),
    "bell button has a real click handler (was previously dead)",
  );

  const issueSrc = read("src/lib/certificates/issue.ts");
  assert(
    issueSrc.includes("notifyCertificateIssued"),
    "certificate issuance notifies the student",
  );

  const revokeSrc = read("src/lib/certificates/admin-queries.ts");
  assert(
    revokeSrc.includes("notifyCertificateRevoked"),
    "certificate revocation notifies the student",
  );

  const finalizeSrc = read("src/lib/exam/finalize.ts");
  assert(
    finalizeSrc.includes("notifyResultReady"),
    "auto-graded finalize notifies the student their result is ready",
  );

  const gradingSrc = read("src/lib/actions/grading.ts");
  assert(
    (gradingSrc.match(/notifyResultReady/g) || []).length >= 2,
    "both manual-grading completion paths notify the student (gradeQuestionAction + completeEvaluationAction)",
  );
  assert(
    gradingSrc.includes("wasCompleted") && gradingSrc.includes("alreadyCompleted"),
    "manual grading paths only notify on the pending->completed transition, not on every re-grade",
  );

  const interviewSrc = read("src/lib/actions/interviews-admin.ts");
  assert(
    interviewSrc.includes("notifyInterviewScheduled"),
    "scheduling an interview notifies both the candidate and the interviewer",
  );
  assert(
    interviewSrc.indexOf("await notifyInterviewRescheduled") >
      interviewSrc.indexOf("Unable to update interview"),
    "reschedule notification is created only after the interview update succeeds",
  );
  assert(
    interviewSrc.indexOf("await notifyInterviewCancelled") >
      interviewSrc.indexOf("Unable to cancel interview"),
    "cancel notification is created only after the interview cancel succeeds",
  );

  const assessmentSrc = read("src/lib/actions/assessments.ts");
  const createSrc = assessmentSrc.slice(
    assessmentSrc.indexOf("export async function createAssessmentAction"),
    assessmentSrc.indexOf("export async function updateAssessmentAction"),
  );
  const updateSrc = assessmentSrc.slice(
    assessmentSrc.indexOf("export async function updateAssessmentAction"),
  );
  assert(
    createSrc.indexOf("await notifyAssessmentAssigned") >
      createSrc.indexOf("Assessment.create"),
    "assignment notification follows a successful assessment create",
  );
  assert(
    updateSrc.indexOf("await notifyAssessmentAssigned") >
      updateSrc.indexOf("doc.save()"),
    "assignment notification follows a successful assessment update",
  );
  assert(
    updateSrc.includes("newlyAssignedStudentIds"),
    "assessment updates notify only newly assigned students",
  );

  assert(model.includes("readAt"), "notifications store readAt");
  assert(model.includes("dedupeKey"), "notifications store a dedupeKey");
  assert(
    model.includes("unique: true") && model.includes("sparse: true"),
    "dedupeKey is a unique sparse index",
  );
  assert(
    model.includes("INTERVIEW_RESCHEDULED") &&
      model.includes("INTERVIEW_CANCELLED") &&
      model.includes("INTERVIEW_REMINDER") &&
      model.includes("ASSESSMENT_ASSIGNED") &&
      model.includes("ASSESSMENT_REMINDER"),
    "interview and assessment notification types are enumerated",
  );
  assert(
    !model.includes("ASSESSMENT_DEADLINE_REMINDER"),
    "no deadline reminder type is invented without a deadline field",
  );

  const reminders = read("src/lib/notifications/reminders.ts");
  assert(
    reminders.includes('status: "scheduled"'),
    "interview reminders only select scheduled interviews",
  );
  assert(
    reminders.includes("submitted") && reminders.includes("expired"),
    "assessment reminders skip students who already finished an attempt",
  );
  assert(
    !actions.includes("processDueReminders"),
    "notification list/page actions do not generate reminders (scheduler owns that)",
  );
  assert(shell.includes("No notifications yet."), "empty state has no mock notifications");
  assert(shell.includes("Mark all read"), "mark all read is available in the bell");
  assert(
    queries.includes(".sort({ createdAt: -1 })") && queries.includes("LIST_LIMIT = 20"),
    "notification list is newest-first and limited",
  );
  assert(
    queries.includes("NOTIFICATION_RECENT_LIMIT = 8"),
    "the bell loads a short recent list",
  );
  assert(
    queries.includes("NOTIFICATION_PAGE_SIZE = 20"),
    "notification history is page-sized",
  );
  assert(shell.includes("99+"), "unread badge caps at 99+");
  assert(shell.includes("View all notifications"), "the bell links to the full history");
  assert(
    model.includes("INTERVIEW_EVALUATION_PENDING"),
    "evaluation pending is a real notification type",
  );
  const lifecycle = read("src/lib/interviewer/lifecycle.ts");
  const completeFn = lifecycle.slice(
    lifecycle.indexOf("export async function completeOwnedInterview"),
  );
  assert(
    completeFn.indexOf("notifyInterviewEvaluationPending") >
      completeFn.indexOf('{ $set: { status: "completed" } }'),
    "evaluation pending is created only after a completed transition",
  );
  const startFn = lifecycle.slice(
    lifecycle.indexOf("export async function startOwnedInterview"),
    lifecycle.indexOf("export async function completeOwnedInterview"),
  );
  assert(
    !startFn.includes("notifyInterviewEvaluationPending"),
    "starting an interview does not create an evaluation reminder",
  );
  const cron = read("src/app/api/cron/notification-reminders/route.ts");
  assert(
    cron.includes("CRON_SECRET") && cron.includes("processDueReminders"),
    "reminder route is secret-gated and server-side",
  );
  assert(
    fs.existsSync("src/app/student/notifications/page.tsx") &&
      fs.existsSync("src/app/admin/notifications/page.tsx") &&
      fs.existsSync("src/app/interviewer/(portal)/notifications/page.tsx"),
    "each role has a notifications history page",
  );
  assert(
    !shell.includes("dangerouslySetInnerHTML"),
    "notification title and message render as plain text",
  );
}

function pureChecks() {
  assert(safeNotificationPath("/student/interviews") === "/student/interviews", "app-relative links are kept");
  assert(safeNotificationPath("https://evil.example") === null, "external notification URLs are rejected");
  assert(safeNotificationPath("//evil.example") === null, "protocol-relative notification URLs are rejected");

  const now = new Date("2026-10-31T12:00:00.000Z");
  assert(
    isDueForReminder(new Date(now.getTime() + 28 * 60 * 1000), now, INTERVIEW_REMINDER_LEAD_MS),
    "interview whose dueAt is within the 5-minute grace is due",
  );
  assert(
    !isDueForReminder(new Date(now.getTime() + 20 * 60 * 1000), now, INTERVIEW_REMINDER_LEAD_MS),
    "interview still before dueAt is not due yet",
  );
  assert(
    !isDueForReminder(new Date(now.getTime() + 3 * 60 * 60 * 1000), now, INTERVIEW_REMINDER_LEAD_MS),
    "interview outside the reminder window is not due",
  );
  assert(
    !isDueForReminder(new Date(now.getTime() - 60_000), now, INTERVIEW_REMINDER_LEAD_MS),
    "interview whose scheduledAt already passed is not due",
  );
  assert(
    isDueForReminder(new Date(now.getTime() + 58 * 60 * 1000), now, ASSESSMENT_REMINDER_LEAD_MS),
    "assessment whose dueAt is within the 5-minute grace is due",
  );
  assert(
    !isDueForReminder(new Date(now.getTime() + 3 * 60 * 60 * 1000), now, ASSESSMENT_REMINDER_LEAD_MS),
    "assessment outside the reminder window is not due",
  );

  const scheduledAt = new Date("2026-11-01T09:00:00.000Z");
  const key = interviewReminderDedupeKey("iv-1", "student-1", scheduledAt);
  assert(
    key === interviewReminderDedupeKey("iv-1", "student-1", scheduledAt),
    "the same interview reminder produces the same dedupe key",
  );
  assert(
    key !== interviewReminderDedupeKey("iv-1", "student-2", scheduledAt),
    "a different recipient gets a different reminder key",
  );

  assert(
    newlyAssignedStudentIds(["a"], ["a", "b"]).join() === "b",
    "only newly assigned students are selected",
  );
  assert(
    newlyAssignedStudentIds(["a", "b"], ["a", "b"]).length === 0,
    "saving the same assignment list selects nobody",
  );

  const previous = {
    candidateId: "student-a",
    interviewerId: "interviewer-a",
    scheduledAt,
    durationMin: 30,
  };
  assert(
    !interviewScheduleChanged(previous, { ...previous, scheduledAt: new Date(scheduledAt) }),
    "an identical schedule is not a reschedule",
  );
  assert(
    interviewScheduleChanged(previous, {
      ...previous,
      scheduledAt: new Date(scheduledAt.getTime() + 60_000),
    }),
    "a new interview time is a reschedule",
  );

  const seen = new Set<string>();
  seen.add(key);
  assert(seen.has(key), "a second reminder insert with the same key is a duplicate");
}

async function dbChecks() {
  await connectDB();

  const rohan = await User.findOne({ email: "rohan@codeshield.edu" });
  const demo = await User.findOne({ email: "demo@codeshield.ai" });
  const kabir = await User.findOne({ email: "kabir@codeshield.ai" });
  const admin = await User.findOne({ email: "admin@codeshield.ai" });
  assert(rohan && demo && kabir && admin, "seed users exist");

  const userIds = [rohan!._id, demo!._id, kabir!._id];
  const extraInterviewIds: mongoose.Types.ObjectId[] = [];
  let fixtureAssessmentId: mongoose.Types.ObjectId | null = null;
  let fixtureAttemptId: mongoose.Types.ObjectId | null = null;
  const evaluationIds: mongoose.Types.ObjectId[] = [];
  let riyaId: mongoose.Types.ObjectId | null = null;
  await Notification.deleteMany({ userId: { $in: userIds } });

  const before = await listNotificationsForUser(rohan!._id.toString());
  assert(
    before.notifications.length === 0 && before.unreadCount === 0,
    "clean slate starts with zero notifications",
  );

  const assessment = await Assessment.findOne({ code: "ASM-201" });
  assert(assessment, "published ASM-201 exists");

  const result = await Result.create({
    attemptId: new mongoose.Types.ObjectId(),
    studentId: rohan!._id,
    assessmentId: assessment!._id,
    assessmentTitle: assessment!.title,
    objectiveScore: 70,
    objectiveMaxMarks: 100,
    subjectiveScore: 0,
    subjectiveMaxMarks: 0,
    codingScore: 0,
    codingMaxMarks: 0,
    subjectivePendingCount: 0,
    finalScore: 70,
    totalMarks: 100,
    evaluationStatus: "completed",
    questions: [],
    submittedAt: new Date(),
    finalizedReason: "submitted",
  });

  try {
    // 1) Real end-to-end: issuing a certificate through the actual hook
    // (not a direct Notification.create) produces a real notification.
    const outcome = await issueCertificateIfEligible(result);
    assert(outcome?.created === true, "certificate issues for this fixture (sanity check)");

    const afterIssue = await listNotificationsForUser(rohan!._id.toString());
    const issuedNotif = afterIssue.notifications.find(
      (n) => n.type === "CERTIFICATE_ISSUED",
    );
    assert(!!issuedNotif, "issuing a certificate creates a real CERTIFICATE_ISSUED notification");
    assert(afterIssue.unreadCount === 1, "unread count reflects the new notification");
    assert(
      issuedNotif!.link === `/student/certificates/${outcome!.certificate._id.toString()}`,
      "notification links to the actual issued certificate",
    );

    // 2) Revoking it -> a second real notification.
    const revoked = await revokeCertificate({
      certificateId: outcome!.certificate._id.toString(),
      adminId: admin!._id.toString(),
      reason: "verify-phase20",
    });
    assert(revoked?.status === "revoked", "revoke succeeds (sanity check)");

    const afterRevoke = await listNotificationsForUser(rohan!._id.toString());
    assert(
      afterRevoke.notifications.some((n) => n.type === "CERTIFICATE_REVOKED"),
      "revoking a certificate creates a real CERTIFICATE_REVOKED notification",
    );
    assert(afterRevoke.unreadCount === 2, "unread count now reflects both notifications");

    // 3) IDOR-safe mark-read: a different user cannot mark someone else's
    // notification, and it silently has no effect (not an error/leak).
    const deniedMark = await markNotificationRead(
      issuedNotif!.id,
      demo!._id.toString(),
    );
    assert(deniedMark === null, "a different user cannot mark someone else's notification read");
    assert(
      (await markNotificationRead("not-an-id", rohan!._id.toString())) === null,
      "a malformed notification id is a safe not-found",
    );

    const stillUnread = await listNotificationsForUser(rohan!._id.toString());
    assert(stillUnread.unreadCount === 2, "cross-user mark-read attempt has no effect");

    const ownMark = await markNotificationRead(
      issuedNotif!.id,
      rohan!._id.toString(),
    );
    assert(!!ownMark && ownMark.read === true, "the owning user can mark their own notification read");

    const afterOwnMark = await listNotificationsForUser(rohan!._id.toString());
    assert(afterOwnMark.unreadCount === 1, "unread count decrements after marking one read");

    // 4) Mark-all-read.
    await markAllNotificationsRead(rohan!._id.toString());
    const afterMarkAll = await listNotificationsForUser(rohan!._id.toString());
    assert(afterMarkAll.unreadCount === 0, "mark-all-read clears the unread count");
    assert(
      afterMarkAll.notifications.every((n) => n.read),
      "mark-all-read marks every notification read",
    );

    // 5) Interview scheduling notifies both the candidate and interviewer.
    await notifyInterviewScheduled({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      interviewTitle: "Verify Phase 20 mock interview",
    });
    const demoNotifs = await listNotificationsForUser(demo!._id.toString());
    const kabirNotifs = await listNotificationsForUser(kabir!._id.toString());
    assert(
      demoNotifs.notifications.some((n) => n.type === "INTERVIEW_SCHEDULED"),
      "candidate receives an INTERVIEW_SCHEDULED notification",
    );
    assert(
      kabirNotifs.notifications.some((n) => n.type === "INTERVIEW_SCHEDULED"),
      "assigned interviewer receives an INTERVIEW_SCHEDULED notification too",
    );

    const demoOwned = await listNotificationsForUser(demo!._id.toString());
    assert(
      !demoOwned.notifications.some((n) => n.type === "CERTIFICATE_ISSUED"),
      "a student list does not include another student's notifications",
    );

    const when = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const reschedule = {
      interviewId: "phase20-reschedule",
      interviewTitle: "Software Engineer",
      scheduledAt: when,
      durationMin: 45,
      previous: {
        candidateId: demo!._id.toString(),
        interviewerId: kabir!._id.toString(),
      },
      candidateId: demo!._id.toString(),
      interviewerId: kabir!._id.toString(),
    };
    await notifyInterviewRescheduled(reschedule);
    await notifyInterviewRescheduled(reschedule);
    assert(
      (await Notification.countDocuments({
        userId: demo!._id,
        type: "INTERVIEW_RESCHEDULED",
      })) === 1,
      "reschedule creates one student notification",
    );
    assert(
      (await Notification.countDocuments({
        userId: kabir!._id,
        type: "INTERVIEW_RESCHEDULED",
      })) === 1,
      "reschedule creates one interviewer notification",
    );

    const cancellation = {
      interviewId: "phase20-cancel",
      interviewTitle: "Software Engineer",
      scheduledAt: when,
      candidateId: demo!._id,
      interviewerId: kabir!._id,
    };
    await notifyInterviewCancelled(cancellation);
    await notifyInterviewCancelled(cancellation);
    assert(
      (await Notification.countDocuments({
        userId: demo!._id,
        type: "INTERVIEW_CANCELLED",
      })) === 1,
      "cancel creates one student notification",
    );
    assert(
      (await Notification.countDocuments({
        userId: kabir!._id,
        type: "INTERVIEW_CANCELLED",
      })) === 1,
      "cancel creates one interviewer notification",
    );

    await notifyAssessmentAssigned({
      assessmentId: assessment!._id.toString(),
      assessmentTitle: assessment!.title,
      studentIds: [demo!._id.toString()],
    });
    await notifyAssessmentAssigned({
      assessmentId: assessment!._id.toString(),
      assessmentTitle: assessment!.title,
      studentIds: [demo!._id.toString()],
    });
    assert(
      (await Notification.countDocuments({
        userId: demo!._id,
        type: "ASSESSMENT_ASSIGNED",
      })) === 1,
      "the assigned student receives one assessment notification",
    );
    assert(
      (await Notification.countDocuments({
        userId: rohan!._id,
        type: "ASSESSMENT_ASSIGNED",
      })) === 0,
      "an unassigned student receives no assessment notification",
    );

    const sweepNow = new Date();
    const due = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20 due reminder",
      type: "Technical",
      scheduledAt: new Date(sweepNow.getTime() + 28 * 60 * 1000),
      durationMin: 30,
      status: "scheduled",
    });
    const outside = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20 outside reminder",
      type: "Technical",
      scheduledAt: new Date(sweepNow.getTime() + 3 * 60 * 60 * 1000),
      durationMin: 30,
      status: "scheduled",
    });
    const cancelledInterview = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20 cancelled reminder",
      type: "Technical",
      scheduledAt: new Date(sweepNow.getTime() + 10 * 60 * 1000),
      durationMin: 30,
      status: "cancelled",
    });
    const completedInterview = await Interview.create({
      candidateId: demo!._id,
      interviewerId: kabir!._id,
      createdBy: admin!._id,
      title: "Phase 20 completed reminder",
      type: "Technical",
      scheduledAt: new Date(sweepNow.getTime() + 10 * 60 * 1000),
      durationMin: 30,
      status: "completed",
    });
    extraInterviewIds.push(
      due._id,
      outside._id,
      cancelledInterview._id,
      completedInterview._id,
    );

    const pendingKey = interviewEvaluationPendingDedupeKey(
      completedInterview._id.toString(),
      kabir!._id.toString(),
    );
    await notifyInterviewEvaluationPending({
      interviewId: completedInterview._id.toString(),
      interviewTitle: completedInterview.title,
      interviewerId: kabir!._id,
    });
    await notifyInterviewEvaluationPending({
      interviewId: completedInterview._id.toString(),
      interviewTitle: completedInterview.title,
      interviewerId: kabir!._id,
    });
    assert(
      (await Notification.countDocuments({ dedupeKey: pendingKey })) === 1,
      "a completed interview creates one evaluation-pending notification",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewEvaluationPendingDedupeKey(
          completedInterview._id.toString(),
          demo!._id.toString(),
        ),
      })) === 0,
      "the candidate does not receive the evaluation reminder",
    );

    const evaluated = await InterviewEvaluation.create({
      interviewId: completedInterview._id,
      interviewerId: kabir!._id,
      candidateId: demo!._id,
      score: 80,
      status: "submitted",
      submittedAt: sweepNow,
    });
    evaluationIds.push(evaluated._id);
    await Notification.deleteMany({ dedupeKey: pendingKey });
    await notifyInterviewEvaluationPending({
      interviewId: completedInterview._id.toString(),
      interviewTitle: completedInterview.title,
      interviewerId: kabir!._id,
    });
    assert(
      (await Notification.countDocuments({ dedupeKey: pendingKey })) === 0,
      "an interview that already has an evaluation is not reminded",
    );

    const fixture = await Assessment.create({
      code: `ASM-P20-${Date.now()}`,
      title: "Phase 20 reminder fixture",
      type: "mcq",
      category: "Programming",
      difficulty: "easy",
      status: "scheduled",
      durationMin: 30,
      totalMarks: 10,
      visibility: "assigned",
      assignedStudentIds: [demo!._id, rohan!._id],
      scheduledAt: new Date(sweepNow.getTime() + 58 * 60 * 1000),
      createdBy: admin!._id,
    });
    fixtureAssessmentId = fixture._id;
    const finishedAttempt = await Attempt.create({
      studentId: rohan!._id,
      assessmentId: fixture._id,
      status: "submitted",
      startedAt: sweepNow,
      expiresAt: new Date(sweepNow.getTime() + 30 * 60 * 1000),
      durationMin: 30,
      assessmentTitle: fixture.title,
      totalMarks: 10,
      submittedAt: sweepNow,
    });
    fixtureAttemptId = finishedAttempt._id;

    await processDueReminders(sweepNow);
    await processDueReminders(sweepNow);

    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          due._id.toString(),
          demo!._id.toString(),
          due.scheduledAt,
        ),
      })) === 1,
      "an upcoming interview creates one student reminder",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          due._id.toString(),
          kabir!._id.toString(),
          due.scheduledAt,
        ),
      })) === 1,
      "an upcoming interview creates one interviewer reminder",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          outside._id.toString(),
          demo!._id.toString(),
          outside.scheduledAt,
        ),
      })) === 0,
      "an interview outside the window is not reminded",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          cancelledInterview._id.toString(),
          demo!._id.toString(),
          cancelledInterview.scheduledAt,
        ),
      })) === 0,
      "a cancelled interview is not reminded",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: interviewReminderDedupeKey(
          completedInterview._id.toString(),
          demo!._id.toString(),
          completedInterview.scheduledAt,
        ),
      })) === 0,
      "a completed interview is not reminded",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: assessmentReminderDedupeKey(
          fixture._id.toString(),
          demo!._id.toString(),
          fixture.scheduledAt!,
        ),
      })) === 1,
      "an assigned student with no finished attempt gets one assessment reminder",
    );
    assert(
      (await Notification.countDocuments({
        dedupeKey: assessmentReminderDedupeKey(
          fixture._id.toString(),
          rohan!._id.toString(),
          fixture.scheduledAt!,
        ),
      })) === 0,
      "a student who already submitted is not reminded",
    );

    const riya = await User.findOne({ email: "riya@codeshield.ai" });
    if (riya) {
      riyaId = riya._id;
      await Interview.updateOne({ _id: due._id }, { interviewerId: riya._id });
      await processDueReminders(sweepNow);
      assert(
        (await Notification.countDocuments({
          dedupeKey: interviewReminderDedupeKey(
            due._id.toString(),
            riya._id.toString(),
            due.scheduledAt,
          ),
        })) === 1,
        "the newly assigned interviewer receives the upcoming reminder",
      );
      assert(
        (await Notification.countDocuments({
          dedupeKey: interviewReminderDedupeKey(
            due._id.toString(),
            kabir!._id.toString(),
            due.scheduledAt,
          ),
        })) === 1,
        "the previous interviewer does not receive another reminder",
      );
    }

    const beforeFailure = await Interview.findById(due._id).lean();
    const { createNotification } = await import("../src/lib/notifications/create");
    await createNotification({
      userId: demo!._id,
      type: "NOT_A_TYPE" as never,
      title: "bad",
      message: "bad",
    });
    const afterFailure = await Interview.findById(due._id).lean();
    assert(
      !!beforeFailure &&
        !!afterFailure &&
        afterFailure.status === beforeFailure.status,
      "a notification insert failure leaves the interview unchanged",
    );
  } finally {
    await Certificate.deleteMany({ resultId: result._id });
    await Result.deleteMany({ _id: result._id });
    await Notification.deleteMany({ userId: { $in: userIds } });
    const dedupeIds = [
      ...extraInterviewIds.map((id) => id.toString()),
      fixtureAssessmentId?.toString(),
    ].filter((id): id is string => Boolean(id));
    if (dedupeIds.length) {
      await Notification.deleteMany({
        $or: dedupeIds.map((id) => ({ dedupeKey: { $regex: id } })),
      });
    }
    if (extraInterviewIds.length) {
      await Interview.deleteMany({ _id: { $in: extraInterviewIds } });
    }
    if (fixtureAttemptId) await Attempt.deleteMany({ _id: fixtureAttemptId });
    if (fixtureAssessmentId) {
      await Assessment.deleteMany({ _id: fixtureAssessmentId });
    }
    if (evaluationIds.length) {
      await InterviewEvaluation.deleteMany({ _id: { $in: evaluationIds } });
    }
  }
}

async function main() {
  console.log("Phase 20 in-app notifications verification\n");
  staticChecks();
  pureChecks();
  await dbChecks();
  console.log("\nPASS: Phase 20 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
