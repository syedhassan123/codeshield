import mongoose from "mongoose";
import {
  formatInterviewDate,
  formatInterviewDateTime,
  formatInterviewStatus,
} from "@/lib/interviewer/format";
import { isValidObjectId } from "@/lib/interviewer/queries";
import { Interview } from "@/models/Interview";
import type { InterviewStatus, InterviewType } from "@/types/interview";

const INTERVIEWER_FIELDS = "name";

export type SerializedStudentInterview = {
  id: string;
  title: string;
  type: InterviewType;
  interviewerName: string;
  formattedDate: string;
  formattedTime: string;
  durationMin: number;
  status: InterviewStatus;
  displayStatus: string;
  meetingUrl: string | null;
  isJoinable: boolean;
};

type InterviewLean = {
  _id: mongoose.Types.ObjectId;
  title: string;
  type: InterviewType;
  scheduledAt: Date;
  durationMin: number;
  status: InterviewStatus;
  meetingUrl?: string | null;
  interviewerId:
    | { name: string }
    | mongoose.Types.ObjectId;
};

function serializeStudentInterview(doc: InterviewLean): SerializedStudentInterview {
  const interviewer =
    doc.interviewerId instanceof mongoose.Types.ObjectId
      ? null
      : doc.interviewerId;
  const formatted = formatInterviewDateTime(doc.scheduledAt);
  const [, formattedTime = ""] = formatted.split(" · ");
  const status = doc.status;

  return {
    id: doc._id.toString(),
    title: doc.title,
    type: doc.type,
    interviewerName: interviewer?.name ?? "Interviewer",
    formattedDate: formatInterviewDate(doc.scheduledAt),
    formattedTime,
    durationMin: doc.durationMin,
    status,
    displayStatus: formatInterviewStatus(status),
    meetingUrl: doc.meetingUrl ?? null,
    isJoinable: status === "scheduled" || status === "in_progress",
  };
}

export async function listStudentInterviews(
  studentId: string,
): Promise<SerializedStudentInterview[]> {
  const docs = await Interview.find({
    candidateId: new mongoose.Types.ObjectId(studentId),
  })
    .sort({ scheduledAt: -1 })
    .populate("interviewerId", INTERVIEWER_FIELDS)
    .lean<InterviewLean[]>();

  return docs.map(serializeStudentInterview);
}

export async function countStudentInterviews(studentId: string) {
  return Interview.countDocuments({
    candidateId: new mongoose.Types.ObjectId(studentId),
    status: { $ne: "cancelled" },
  });
}

export async function getStudentUpcomingInterviews(
  studentId: string,
  limit = 4,
): Promise<SerializedStudentInterview[]> {
  const docs = await Interview.find({
    candidateId: new mongoose.Types.ObjectId(studentId),
    status: { $in: ["scheduled", "in_progress"] },
  })
    .sort({ scheduledAt: 1 })
    .limit(limit)
    .populate("interviewerId", INTERVIEWER_FIELDS)
    .lean<InterviewLean[]>();

  return docs.map(serializeStudentInterview);
}

export async function getStudentInterview(
  interviewId: string,
  studentId: string,
): Promise<SerializedStudentInterview | null> {
  if (!isValidObjectId(interviewId)) {
    return null;
  }

  const doc = await Interview.findOne({
    _id: interviewId,
    candidateId: new mongoose.Types.ObjectId(studentId),
  })
    .populate("interviewerId", INTERVIEWER_FIELDS)
    .lean<InterviewLean>();

  if (!doc) {
    return null;
  }

  return serializeStudentInterview(doc);
}

export function partitionStudentInterviews(interviews: SerializedStudentInterview[]) {
  const upcoming = interviews
    .filter(
      (item) => item.status === "scheduled" || item.status === "in_progress",
    )
    .sort((a, b) => a.formattedDate.localeCompare(b.formattedDate));
  const past = interviews
    .filter(
      (item) => item.status === "completed" || item.status === "cancelled",
    )
    .sort((a, b) => b.formattedDate.localeCompare(a.formattedDate));

  return { upcoming, past };
}
