import mongoose from "mongoose";
import { initials } from "@/lib/utils";
import {
  formatInterviewDateTime,
  formatInterviewStatus,
} from "@/lib/interviewer/format";
import { Interview } from "@/models/Interview";
import { User } from "@/models/User";
import type { InterviewStatus, InterviewType } from "@/types/interview";
import type { UserRole } from "@/types/user";

const CANDIDATE_FIELDS = "name avatar course year role";

export type SerializedInterviewerCandidate = {
  id: string;
  name: string;
  initials: string;
  course: string;
  linkedScorePercent: number | null;
  interviewCount: number;
};

export type SerializedInterview = {
  id: string;
  candidateName: string;
  candidateInitials: string;
  title: string;
  type: InterviewType;
  formattedDate: string;
  formattedTime: string;
  durationMin: number;
  status: InterviewStatus;
  displayStatus: string;
};

type PopulatedCandidate = {
  _id: mongoose.Types.ObjectId;
  name: string;
  avatar?: string;
  course?: string;
};

type InterviewLean = {
  _id: mongoose.Types.ObjectId;
  title: string;
  type: InterviewType;
  scheduledAt: Date;
  durationMin: number;
  status: InterviewStatus;
  candidateId: PopulatedCandidate | mongoose.Types.ObjectId;
};

export function isValidObjectId(id: string): boolean {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return false;
  }
  return String(new mongoose.Types.ObjectId(id)) === id;
}

/** Server-local day boundaries for dashboard metrics (documented assumption). */
export function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function endOfDay(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() + 1);
  return next;
}

export function startOfWeek(date: Date) {
  const next = startOfDay(date);
  const day = next.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diff);
  return next;
}

export function endOfWeek(date: Date) {
  const next = startOfWeek(date);
  next.setDate(next.getDate() + 7);
  return next;
}

function serializeInterview(doc: InterviewLean): SerializedInterview {
  const candidate =
    doc.candidateId instanceof mongoose.Types.ObjectId
      ? null
      : doc.candidateId;
  const candidateName = candidate?.name ?? "Unknown";
  const formatted = formatInterviewDateTime(doc.scheduledAt);
  const [formattedDate, formattedTime = ""] = formatted.split(" · ");

  return {
    id: doc._id.toString(),
    candidateName,
    candidateInitials: initials(candidateName),
    title: doc.title,
    type: doc.type,
    formattedDate,
    formattedTime,
    durationMin: doc.durationMin,
    status: doc.status,
    displayStatus: formatInterviewStatus(doc.status),
  };
}

export type InterviewerDashboardMetrics = {
  todayCount: number;
  weekCount: number;
  completedCount: number;
  avgRating: null;
  todaySchedule: SerializedInterview[];
  pendingEvaluationsCount: 0;
};

export async function getInterviewerDashboardMetrics(
  interviewerId: string,
): Promise<InterviewerDashboardMetrics> {
  const interviewerOid = new mongoose.Types.ObjectId(interviewerId);
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = endOfWeek(now);
  const activeFilter = { status: { $ne: "cancelled" as const } };

  const [todayCount, weekCount, completedCount, todayDocs] = await Promise.all([
    Interview.countDocuments({
      interviewerId: interviewerOid,
      scheduledAt: { $gte: todayStart, $lt: todayEnd },
      ...activeFilter,
    }),
    Interview.countDocuments({
      interviewerId: interviewerOid,
      scheduledAt: { $gte: weekStart, $lt: weekEnd },
      ...activeFilter,
    }),
    Interview.countDocuments({
      interviewerId: interviewerOid,
      status: "completed",
    }),
    Interview.find({
      interviewerId: interviewerOid,
      scheduledAt: { $gte: todayStart, $lt: todayEnd },
      ...activeFilter,
    })
      .sort({ scheduledAt: 1 })
      .limit(4)
      .populate("candidateId", CANDIDATE_FIELDS)
      .lean<InterviewLean[]>(),
  ]);

  return {
    todayCount,
    weekCount,
    completedCount,
    avgRating: null,
    todaySchedule: todayDocs.map(serializeInterview),
    pendingEvaluationsCount: 0,
  };
}

export type ListInterviewerInterviewsOptions = {
  limit?: number;
  status?: InterviewStatus;
};

export async function listInterviewerInterviews(
  interviewerId: string,
  options: ListInterviewerInterviewsOptions = {},
): Promise<SerializedInterview[]> {
  const interviewerOid = new mongoose.Types.ObjectId(interviewerId);
  const filter: Record<string, unknown> = { interviewerId: interviewerOid };

  if (options.status) {
    filter.status = options.status;
  }

  let query = Interview.find(filter)
    .sort({ scheduledAt: 1 })
    .populate("candidateId", CANDIDATE_FIELDS);

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const docs = await query.lean<InterviewLean[]>();
  return docs.map(serializeInterview);
}

export async function getOwnedInterview(
  interviewId: string,
  interviewerId: string,
): Promise<SerializedInterview | null> {
  if (!isValidObjectId(interviewId)) {
    return null;
  }

  const doc = await Interview.findOne({
    _id: interviewId,
    interviewerId: new mongoose.Types.ObjectId(interviewerId),
  })
    .populate("candidateId", CANDIDATE_FIELDS)
    .lean<InterviewLean>();

  if (!doc) {
    return null;
  }

  return serializeInterview(doc);
}

export type InterviewRoomContext = SerializedInterview & {
  interviewerInitials: string;
};

/**
 * Lobby/room access for assigned interviewer or candidate.
 * Admin and unrelated users receive null (same as not found).
 */
export async function getInterviewForParticipant(
  interviewId: string,
  userId: string,
  role: UserRole,
): Promise<InterviewRoomContext | null> {
  if (!isValidObjectId(interviewId)) {
    return null;
  }

  const userOid = new mongoose.Types.ObjectId(userId);
  const filter: Record<string, unknown> = { _id: interviewId };

  if (role === "interviewer") {
    filter.interviewerId = userOid;
  } else if (role === "student") {
    filter.candidateId = userOid;
  } else {
    return null;
  }

  const doc = await Interview.findOne(filter)
    .populate("candidateId", CANDIDATE_FIELDS)
    .populate("interviewerId", "name avatar")
    .lean<
      InterviewLean & {
        interviewerId: { name: string; avatar?: string } | mongoose.Types.ObjectId;
      }
    >();

  if (!doc) {
    return null;
  }

  const serialized = serializeInterview(doc);
  const interviewer =
    doc.interviewerId instanceof mongoose.Types.ObjectId
      ? null
      : doc.interviewerId;

  return {
    ...serialized,
    interviewerInitials: initials(interviewer?.name ?? "You"),
  };
}

const CANDIDATE_LIST_LIMIT = 100;

type CandidateInterviewAggregate = {
  _id: mongoose.Types.ObjectId;
  interviewCount: number;
  candidate: {
    _id: mongoose.Types.ObjectId;
    name: string;
    avatar?: string;
    course?: string;
    year?: string;
    role: string;
  };
};

/**
 * Proves the candidate is assigned to at least one interview owned by the interviewer.
 * Does not load candidate data by id alone.
 */
export async function hasInterviewerCandidateAccess(
  candidateId: string,
  interviewerId: string,
): Promise<boolean> {
  if (!isValidObjectId(candidateId)) {
    return false;
  }

  const assignment = await Interview.exists({
    interviewerId: new mongoose.Types.ObjectId(interviewerId),
    candidateId: new mongoose.Types.ObjectId(candidateId),
  });

  return Boolean(assignment);
}

export async function listInterviewerCandidates(
  interviewerId: string,
): Promise<SerializedInterviewerCandidate[]> {
  const interviewerOid = new mongoose.Types.ObjectId(interviewerId);

  const rows = await Interview.aggregate<CandidateInterviewAggregate>([
    { $match: { interviewerId: interviewerOid } },
    {
      $group: {
        _id: "$candidateId",
        interviewCount: { $sum: 1 },
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "candidate",
        pipeline: [
          {
            $project: {
              name: 1,
              avatar: 1,
              course: 1,
              year: 1,
              role: 1,
            },
          },
        ],
      },
    },
    { $unwind: "$candidate" },
    { $match: { "candidate.role": "student" } },
    { $sort: { "candidate.name": 1 } },
    { $limit: CANDIDATE_LIST_LIMIT },
  ]);

  return rows.map((row) => ({
    id: row._id.toString(),
    name: row.candidate.name,
    initials: initials(row.candidate.name),
    course: row.candidate.course || "—",
    linkedScorePercent: null,
    interviewCount: row.interviewCount,
  }));
}

export async function getInterviewerCandidate(
  candidateId: string,
  interviewerId: string,
): Promise<SerializedInterviewerCandidate | null> {
  if (!isValidObjectId(candidateId)) {
    return null;
  }

  const hasAccess = await hasInterviewerCandidateAccess(
    candidateId,
    interviewerId,
  );
  if (!hasAccess) {
    return null;
  }

  const [candidate, interviewCount] = await Promise.all([
    User.findById(candidateId).select(CANDIDATE_FIELDS).lean<{
      _id: mongoose.Types.ObjectId;
      name: string;
      course?: string;
      role?: string;
    }>(),
    Interview.countDocuments({
      interviewerId: new mongoose.Types.ObjectId(interviewerId),
      candidateId: new mongoose.Types.ObjectId(candidateId),
    }),
  ]);

  if (!candidate || candidate.role !== "student") {
    return null;
  }

  return {
    id: candidate._id.toString(),
    name: candidate.name,
    initials: initials(candidate.name),
    course: candidate.course || "—",
    linkedScorePercent: null,
    interviewCount,
  };
}

export async function listInterviewerCandidateInterviews(
  candidateId: string,
  interviewerId: string,
): Promise<SerializedInterview[]> {
  if (!isValidObjectId(candidateId)) {
    return [];
  }

  const hasAccess = await hasInterviewerCandidateAccess(
    candidateId,
    interviewerId,
  );
  if (!hasAccess) {
    return [];
  }

  const docs = await Interview.find({
    interviewerId: new mongoose.Types.ObjectId(interviewerId),
    candidateId: new mongoose.Types.ObjectId(candidateId),
  })
    .sort({ scheduledAt: -1 })
    .populate("candidateId", CANDIDATE_FIELDS)
    .lean<InterviewLean[]>();

  return docs.map(serializeInterview);
}
