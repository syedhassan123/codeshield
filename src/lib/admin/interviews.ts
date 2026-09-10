import mongoose from "mongoose";
import {
  formatInterviewDate,
  formatInterviewDateTime,
  formatInterviewStatus,
} from "@/lib/interviewer/format";
import { isValidObjectId } from "@/lib/interviewer/queries";
import { Interview } from "@/models/Interview";
import { InterviewEvaluation } from "@/models/InterviewEvaluation";
import { User } from "@/models/User";
import type { InterviewStatus, InterviewType } from "@/types/interview";

const USER_SELECT = "name email course role status";

export type AssignableUser = {
  id: string;
  name: string;
  email: string;
  course: string;
};

export type SerializedAdminInterview = {
  id: string;
  candidateId: string;
  interviewerId: string;
  candidateName: string;
  interviewerName: string;
  title: string;
  type: InterviewType;
  formattedDate: string;
  formattedTime: string;
  scheduledAtInput: string;
  durationMin: number;
  status: InterviewStatus;
  displayStatus: string;
  meetingUrl: string | null;
  hasEvaluation: boolean;
};

export type AdminInterviewerPanelItem = {
  id: string;
  name: string;
  initials: string;
  interviewCount: number;
};

type InterviewLean = {
  _id: mongoose.Types.ObjectId;
  candidateId:
    | { _id: mongoose.Types.ObjectId; name: string }
    | mongoose.Types.ObjectId;
  interviewerId:
    | { _id: mongoose.Types.ObjectId; name: string }
    | mongoose.Types.ObjectId;
  title: string;
  type: InterviewType;
  scheduledAt: Date;
  durationMin: number;
  status: InterviewStatus;
  meetingUrl?: string | null;
};

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function serializeAdminInterview(
  doc: InterviewLean,
  hasEvaluation = false,
): SerializedAdminInterview {
  const candidate =
    doc.candidateId instanceof mongoose.Types.ObjectId ? null : doc.candidateId;
  const interviewer =
    doc.interviewerId instanceof mongoose.Types.ObjectId
      ? null
      : doc.interviewerId;
  const formatted = formatInterviewDateTime(doc.scheduledAt);
  const [, formattedTime = ""] = formatted.split(" · ");

  return {
    id: doc._id.toString(),
    candidateId: candidate?._id.toString() ?? doc.candidateId.toString(),
    interviewerId:
      interviewer?._id.toString() ?? doc.interviewerId.toString(),
    candidateName: candidate?.name ?? "Unknown",
    interviewerName: interviewer?.name ?? "Unknown",
    title: doc.title,
    type: doc.type,
    formattedDate: formatInterviewDate(doc.scheduledAt),
    formattedTime,
    scheduledAtInput: toDatetimeLocalValue(doc.scheduledAt),
    durationMin: doc.durationMin,
    status: doc.status,
    displayStatus: formatInterviewStatus(doc.status),
    meetingUrl: doc.meetingUrl ?? null,
    hasEvaluation,
  };
}

export function parseScheduledAtInput(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid scheduled date/time.");
  }
  return date;
}

export async function listAssignableStudents(): Promise<AssignableUser[]> {
  const docs = await User.find({ role: "student", status: "active" })
    .select(USER_SELECT)
    .sort({ name: 1 })
    .limit(200)
    .lean<Array<{ _id: mongoose.Types.ObjectId; name: string; email: string; course?: string }>>();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    course: doc.course || "—",
  }));
}

export async function listAssignableInterviewers(): Promise<AssignableUser[]> {
  const docs = await User.find({ role: "interviewer", status: "active" })
    .select(USER_SELECT)
    .sort({ name: 1 })
    .limit(100)
    .lean<Array<{ _id: mongoose.Types.ObjectId; name: string; email: string; course?: string }>>();

  return docs.map((doc) => ({
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    course: doc.course || "—",
  }));
}

export async function listAdminInterviews(): Promise<SerializedAdminInterview[]> {
  const docs = await Interview.find()
    .sort({ scheduledAt: -1 })
    .populate("candidateId", "name")
    .populate("interviewerId", "name")
    .lean<InterviewLean[]>();

  const evaluationInterviewIds = new Set(
    (
      await InterviewEvaluation.find({
        interviewId: { $in: docs.map((doc) => doc._id) },
      })
        .select("interviewId")
        .lean()
    ).map((row) => row.interviewId.toString()),
  );

  return docs.map((doc) =>
    serializeAdminInterview(doc, evaluationInterviewIds.has(doc._id.toString())),
  );
}

export async function getAdminInterview(
  interviewId: string,
): Promise<SerializedAdminInterview | null> {
  if (!isValidObjectId(interviewId)) {
    return null;
  }

  const doc = await Interview.findById(interviewId)
    .populate("candidateId", "name")
    .populate("interviewerId", "name")
    .lean<InterviewLean>();

  if (!doc) {
    return null;
  }

  const hasEvaluation = Boolean(
    await InterviewEvaluation.exists({ interviewId: doc._id }),
  );

  return serializeAdminInterview(doc, hasEvaluation);
}

export async function listAdminInterviewerPanel(): Promise<
  AdminInterviewerPanelItem[]
> {
  const rows = await Interview.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
    name: string;
  }>([
    { $group: { _id: "$interviewerId", count: { $sum: 1 } } },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "interviewer",
        pipeline: [{ $project: { name: 1, role: 1 } }],
      },
    },
    { $unwind: "$interviewer" },
    { $match: { "interviewer.role": "interviewer" } },
    { $sort: { "interviewer.name": 1 } },
    {
      $project: {
        _id: 1,
        count: 1,
        name: "$interviewer.name",
      },
    },
  ]);

  return rows.map((row) => ({
    id: row._id.toString(),
    name: row.name,
    initials: row.name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase(),
    interviewCount: row.count,
  }));
}

export async function assertAssignableStudent(candidateId: string) {
  if (!isValidObjectId(candidateId)) {
    throw new Error("Invalid candidate.");
  }
  const user = await User.findById(candidateId).select("role status").lean();
  if (!user || user.role !== "student" || user.status !== "active") {
    throw new Error("Candidate must be an active student.");
  }
  return user;
}

export async function assertAssignableInterviewer(interviewerId: string) {
  if (!isValidObjectId(interviewerId)) {
    throw new Error("Invalid interviewer.");
  }
  const user = await User.findById(interviewerId).select("role status").lean();
  if (!user || user.role !== "interviewer" || user.status !== "active") {
    throw new Error("Interviewer must be an active interviewer.");
  }
  return user;
}
