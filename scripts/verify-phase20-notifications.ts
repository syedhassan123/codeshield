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
import { notifyInterviewScheduled } from "../src/lib/notifications/events";
import { Assessment } from "../src/models/Assessment";
import { Certificate } from "../src/models/Certificate";
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
}

async function dbChecks() {
  await connectDB();

  const rohan = await User.findOne({ email: "rohan@codeshield.edu" });
  const demo = await User.findOne({ email: "demo@codeshield.ai" });
  const kabir = await User.findOne({ email: "kabir@codeshield.ai" });
  const admin = await User.findOne({ email: "admin@codeshield.ai" });
  assert(rohan && demo && kabir && admin, "seed users exist");

  const userIds = [rohan!._id, demo!._id, kabir!._id];
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
  } finally {
    await Certificate.deleteMany({ resultId: result._id });
    await Result.deleteMany({ _id: result._id });
    await Notification.deleteMany({ userId: { $in: userIds } });
  }
}

async function main() {
  console.log("Phase 20 in-app notifications verification\n");
  staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 20 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
