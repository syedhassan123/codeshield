import mongoose from "mongoose";
import { Assessment } from "@/models/Assessment";
import { Certificate } from "@/models/Certificate";
import { Interview } from "@/models/Interview";
import { Question } from "@/models/Question";
import { Result } from "@/models/Result";
import { User } from "@/models/User";
import type { UserRole } from "@/types/user";

export type SearchHit = {
  id: string;
  group: string;
  title: string;
  subtitle: string;
  href: string;
};

const MIN_QUERY_LENGTH = 2;
const PER_GROUP = 5;
const MAX_QUERY_LENGTH = 80;

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeQuery(raw: string) {
  return raw.trim().slice(0, MAX_QUERY_LENGTH);
}

function textFilter(fields: string[], query: string) {
  const pattern = escapeRegex(query);
  return {
    $or: fields.map((field) => ({
      [field]: { $regex: pattern, $options: "i" },
    })),
  };
}

async function searchAdmin(query: string): Promise<SearchHit[]> {
  const [assessments, students, questions] = await Promise.all([
    Assessment.find(textFilter(["title", "code", "category"], query))
      .select("title code category")
      .sort({ updatedAt: -1 })
      .limit(PER_GROUP),
    User.find({
      role: "student",
      ...textFilter(["name", "email", "course"], query),
    })
      .select("name email course")
      .sort({ name: 1 })
      .limit(PER_GROUP),
    Question.find(textFilter(["prompt", "code"], query))
      .select("prompt code type")
      .sort({ updatedAt: -1 })
      .limit(PER_GROUP),
  ]);

  return [
    ...assessments.map((doc) => ({
      id: `assessment:${doc._id.toString()}`,
      group: "Assessments",
      title: doc.title,
      subtitle: [doc.code, doc.category].filter(Boolean).join(" · "),
      href: `/admin/assessments/${doc._id.toString()}`,
    })),
    ...students.map((doc) => ({
      id: `student:${doc._id.toString()}`,
      group: "Students",
      title: doc.name,
      subtitle: [doc.email, doc.course].filter(Boolean).join(" · "),
      href: "/admin/students",
    })),
    ...questions.map((doc) => ({
      id: `question:${doc._id.toString()}`,
      group: "Questions",
      title: doc.prompt,
      subtitle: [doc.code, doc.type].filter(Boolean).join(" · "),
      href: "/admin/questions",
    })),
  ];
}

async function searchStudent(
  userId: string,
  query: string,
): Promise<SearchHit[]> {
  const studentId = new mongoose.Types.ObjectId(userId);
  const [assessments, results, certificates] = await Promise.all([
    Assessment.find({
      status: "published",
      $and: [
        {
          $or: [
            { visibility: "all" },
            { visibility: "assigned", assignedStudentIds: studentId },
          ],
        },
        textFilter(["title", "code", "category"], query),
      ],
    })
      .select("title code category")
      .sort({ publishedAt: -1, updatedAt: -1 })
      .limit(PER_GROUP),
    Result.find({
      studentId,
      ...textFilter(["assessmentTitle"], query),
    })
      .select("assessmentTitle attemptId evaluationStatus")
      .sort({ submittedAt: -1 })
      .limit(PER_GROUP),
    Certificate.find({
      studentId,
      status: "issued",
      ...textFilter(["assessmentTitle", "certificateSerial"], query),
    })
      .select("assessmentTitle certificateSerial")
      .sort({ issuedAt: -1 })
      .limit(PER_GROUP),
  ]);

  return [
    ...assessments.map((doc) => ({
      id: `assessment:${doc._id.toString()}`,
      group: "Assessments",
      title: doc.title,
      subtitle: [doc.code, doc.category].filter(Boolean).join(" · "),
      href: `/student/exam/${doc._id.toString()}`,
    })),
    ...results.map((doc) => ({
      id: `result:${doc._id.toString()}`,
      group: "Results",
      title: doc.assessmentTitle,
      subtitle: doc.evaluationStatus === "completed" ? "Completed" : "Pending",
      href: `/student/exam/result/${doc.attemptId.toString()}`,
    })),
    ...certificates.map((doc) => ({
      id: `certificate:${doc._id.toString()}`,
      group: "Certificates",
      title: doc.assessmentTitle,
      subtitle: doc.certificateSerial,
      href: `/student/certificates/${doc._id.toString()}`,
    })),
  ];
}

async function searchInterviewer(
  userId: string,
  query: string,
): Promise<SearchHit[]> {
  const interviewerId = new mongoose.Types.ObjectId(userId);
  const interviews = await Interview.find({ interviewerId })
    .select("title candidateId type status")
    .sort({ scheduledAt: -1 })
    .limit(80);

  const candidateIds = [
    ...new Set(interviews.map((doc) => doc.candidateId.toString())),
  ];
  const candidates = candidateIds.length
    ? await User.find({
        _id: { $in: candidateIds },
      }).select("name course")
    : [];
  const candidateMap = new Map(
    candidates.map((doc) => [doc._id.toString(), doc]),
  );

  const needle = query.toLowerCase();
  const interviewHits = interviews
    .filter((doc) => {
      const candidate = candidateMap.get(doc.candidateId.toString());
      return (
        doc.title.toLowerCase().includes(needle) ||
        (candidate?.name ?? "").toLowerCase().includes(needle)
      );
    })
    .slice(0, PER_GROUP)
    .map((doc) => {
      const candidate = candidateMap.get(doc.candidateId.toString());
      return {
        id: `interview:${doc._id.toString()}`,
        group: "Interviews",
        title: doc.title,
        subtitle: [candidate?.name, doc.type, doc.status]
          .filter(Boolean)
          .join(" · "),
        href: `/interviewer/lobby/${doc._id.toString()}`,
      };
    });

  const candidateHits = candidates
    .filter(
      (doc) =>
        doc.name.toLowerCase().includes(needle) ||
        (doc.course ?? "").toLowerCase().includes(needle),
    )
    .slice(0, PER_GROUP)
    .map((doc) => ({
      id: `candidate:${doc._id.toString()}`,
      group: "Candidates",
      title: doc.name,
      subtitle: doc.course || "Assigned candidate",
      href: "/interviewer/candidates",
    }));

  return [...interviewHits, ...candidateHits];
}

export async function searchWorkspace(options: {
  role: UserRole;
  userId: string;
  query: string;
}): Promise<SearchHit[]> {
  const query = normalizeQuery(options.query);
  if (query.length < MIN_QUERY_LENGTH) return [];

  if (options.role === "admin") return searchAdmin(query);
  if (options.role === "student") return searchStudent(options.userId, query);
  if (options.role === "interviewer") {
    return searchInterviewer(options.userId, query);
  }
  return [];
}
