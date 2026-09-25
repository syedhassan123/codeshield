import type mongoose from "mongoose";
import { createNotification } from "@/lib/notifications/create";

/** Named, typed wrappers so every call site is self-documenting about
 * exactly which real event triggered the notification. */

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
  candidateId: mongoose.Types.ObjectId;
  interviewerId: mongoose.Types.ObjectId;
  interviewTitle: string;
}) {
  await Promise.all([
    createNotification({
      userId: params.candidateId,
      type: "INTERVIEW_SCHEDULED",
      title: "Interview scheduled",
      message: `You have an interview scheduled: "${params.interviewTitle}".`,
      link: `/student/interviews`,
    }),
    createNotification({
      userId: params.interviewerId,
      type: "INTERVIEW_SCHEDULED",
      title: "New interview assigned",
      message: `You've been assigned to conduct: "${params.interviewTitle}".`,
      link: `/interviewer/interviews`,
    }),
  ]);
}
