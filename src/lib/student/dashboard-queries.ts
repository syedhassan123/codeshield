import mongoose from "mongoose";
import type { ChartPoint } from "@/components/charts/simple-charts";
import { formatRelativeTime } from "@/lib/admin/format";
import { serializeAssessment } from "@/lib/serializers";
import { Assessment } from "@/models/Assessment";
import { Attempt } from "@/models/Attempt";
import { CodingSubmission } from "@/models/CodingSubmission";
import { Result } from "@/models/Result";

export type StudentDashboardStats = {
  assessmentsTaken: number;
  codingSolved: number;
  interviews: number;
  certificates: number;
  averageScorePercent: number | null;
  inProgressAttempts: number;
};

export type StudentDashboardAssessment = ReturnType<
  typeof serializeAssessment
> & {
  attemptStatus: "not_started" | "in_progress" | "completed";
  inProgressAttemptId?: string;
};

export type StudentDashboardActivity = {
  id: string;
  text: string;
  time: string;
  href?: string;
};

function publishedAssessmentQuery(studentId: mongoose.Types.ObjectId) {
  return {
    status: "published" as const,
    $or: [
      { visibility: "all" as const },
      { visibility: "assigned" as const, assignedStudentIds: studentId },
    ],
  };
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildPerformanceTrend(attempts: Array<{ startedAt: Date }>) {
  const from = startOfDay(new Date(Date.now() - 6 * 86400000));
  const countByDay = new Map<string, number>();
  for (const attempt of attempts) {
    if (attempt.startedAt < from) continue;
    const key = startOfDay(attempt.startedAt).toISOString().slice(0, 10);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const points: ChartPoint[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = startOfDay(new Date(Date.now() - i * 86400000));
    const key = date.toISOString().slice(0, 10);
    points.push({
      name: dayNames[date.getDay()],
      value: countByDay.get(key) ?? 0,
    });
  }
  return points;
}

function buildActivityFeed(options: {
  attempts: Array<{
    _id: mongoose.Types.ObjectId;
    assessmentTitle: string;
    status: string;
    submittedAt?: Date | null;
    startedAt: Date;
  }>;
  results: Array<{
    attemptId: mongoose.Types.ObjectId;
    assessmentTitle: string;
    finalScore: number;
    totalMarks: number;
    evaluationStatus: string;
    submittedAt: Date;
  }>;
}) {
  const items: StudentDashboardActivity[] = [];

  for (const result of options.results.slice(0, 4)) {
    items.push({
      id: `result-${result.attemptId.toString()}`,
      text:
        result.evaluationStatus === "completed"
          ? `Result ready: ${result.assessmentTitle} (${result.finalScore}/${result.totalMarks})`
          : `Submitted: ${result.assessmentTitle} — grading pending`,
      time: formatRelativeTime(result.submittedAt),
      href: `/student/exam/result/${result.attemptId.toString()}`,
    });
  }

  for (const attempt of options.attempts) {
    if (attempt.status !== "in_progress") continue;
    items.push({
      id: `attempt-${attempt._id.toString()}`,
      text: `Exam in progress: ${attempt.assessmentTitle}`,
      time: formatRelativeTime(attempt.startedAt),
      href: `/student/exam/session/${attempt._id.toString()}`,
    });
  }

  return items.slice(0, 6);
}

export async function getStudentDashboardData(studentId: string) {
  const studentOid = new mongoose.Types.ObjectId(studentId);

  const [assessmentDocs, attempts, results, codingSolvedAgg, availableCount] =
    await Promise.all([
      Assessment.find(publishedAssessmentQuery(studentOid))
        .sort({ publishedAt: -1, updatedAt: -1 })
        .limit(4),
      Attempt.find({ studentId: studentOid })
        .select(
          "_id assessmentId assessmentTitle status startedAt submittedAt",
        )
        .sort({ startedAt: -1 }),
      Result.find({ studentId: studentOid })
        .select(
          "attemptId assessmentTitle finalScore totalMarks evaluationStatus submittedAt",
        )
        .sort({ submittedAt: -1 })
        .limit(8),
      CodingSubmission.aggregate<{ count: number }>([
        {
          $match: {
            studentId: studentOid,
            kind: "submit",
            finalized: true,
          },
        },
        { $group: { _id: "$questionId" } },
        { $count: "count" },
      ]),
      Assessment.countDocuments(publishedAssessmentQuery(studentOid)),
    ]);

  const attemptByAssessment = new Map(
    attempts.map((attempt) => [attempt.assessmentId.toString(), attempt]),
  );

  const upcoming: StudentDashboardAssessment[] = assessmentDocs.map((doc) => {
    const attempt = attemptByAssessment.get(doc._id.toString());
    let attemptStatus: StudentDashboardAssessment["attemptStatus"] =
      "not_started";
    if (attempt?.status === "in_progress") attemptStatus = "in_progress";
    else if (
      attempt &&
      (attempt.status === "submitted" || attempt.status === "expired")
    ) {
      attemptStatus = "completed";
    }

    return {
      ...serializeAssessment(doc, {
        questionCount: doc.questionIds?.length ?? 0,
      }),
      attemptStatus,
      inProgressAttemptId:
        attempt?.status === "in_progress"
          ? attempt._id.toString()
          : undefined,
    };
  });

  const completedAttempts = attempts.filter(
    (attempt) => attempt.status === "submitted" || attempt.status === "expired",
  );
  const inProgressAttempts = attempts.filter(
    (attempt) => attempt.status === "in_progress",
  ).length;

  const gradedResults = results.filter(
    (result) =>
      result.evaluationStatus === "completed" && result.totalMarks > 0,
  );
  const averageScorePercent =
    gradedResults.length > 0
      ? Math.round(
          gradedResults.reduce(
            (sum, result) =>
              sum + (result.finalScore / result.totalMarks) * 100,
            0,
          ) / gradedResults.length,
        )
      : null;

  const stats: StudentDashboardStats = {
    assessmentsTaken: completedAttempts.length,
    codingSolved: codingSolvedAgg[0]?.count ?? 0,
    interviews: 0,
    certificates: gradedResults.length,
    averageScorePercent,
    inProgressAttempts,
  };

  return {
    stats,
    upcoming,
    performanceTrend: buildPerformanceTrend(attempts),
    activity: buildActivityFeed({ attempts, results }),
    availableAssessmentCount: availableCount,
  };
}
