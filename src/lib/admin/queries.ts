import {
  buildSecuritySummary,
  securityRiskLevelFromTotal,
} from "@/lib/exam/security";
import { countViolations, formatPercent } from "@/lib/admin/format";
import { Assessment } from "@/models/Assessment";
import { Attempt } from "@/models/Attempt";
import { CodingSubmission } from "@/models/CodingSubmission";
import { Result } from "@/models/Result";
import { SecurityEvent } from "@/models/SecurityEvent";
import { User } from "@/models/User";
import { SECURITY_VIOLATION_EVENT_TYPES } from "@/types/exam-security";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return startOfDay(date);
}

function monthsAgo(months: number) {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - months);
  return date;
}

export type AdminDashboardStats = {
  totalStudents: number;
  activeAssessments: number;
  activeAttempts: number;
  securityEvents24h: number;
  completedAttempts: number;
  completedEvaluations: number;
  pendingEvaluations: number;
  violationEvents: number;
  systemStatus: "Operational" | "Degraded";
};

export type ChartPoint = { name: string; value: number };
export type GrowthPoint = {
  name: string;
  students: number;
  interviewers: number;
};
export type SecuritySegment = { label: string; value: number; color: string };

export type AdminSecurityAlert = {
  id: string;
  type: string;
  severity: string;
  student: string;
  assessment: string;
  time: string;
  timestamp: string;
};

export type ActiveMonitoringSession = {
  attemptId: string;
  studentName: string;
  assessmentTitle: string;
  elapsedMs: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  violationCount: number;
  flags: string[];
  status: "safe" | "warning" | "violation";
};

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    totalStudents,
    activeAssessments,
    activeAttempts,
    completedAttempts,
    pendingEvaluations,
    completedEvaluations,
    securityEvents24h,
    violationEvents,
  ] = await Promise.all([
    User.countDocuments({ role: "student" }),
    Assessment.countDocuments({ status: { $in: ["published", "scheduled"] } }),
    Attempt.countDocuments({ status: "in_progress" }),
    Attempt.countDocuments({ status: { $in: ["submitted", "expired"] } }),
    Result.countDocuments({ evaluationStatus: "pending" }),
    Result.countDocuments({ evaluationStatus: "completed" }),
    SecurityEvent.countDocuments({ timestamp: { $gte: since24h } }),
    SecurityEvent.countDocuments({
      eventType: { $in: [...SECURITY_VIOLATION_EVENT_TYPES] },
    }),
  ]);

  return {
    totalStudents,
    activeAssessments,
    activeAttempts,
    securityEvents24h,
    completedAttempts,
    completedEvaluations,
    pendingEvaluations,
    violationEvents,
    systemStatus: "Operational",
  };
}

export async function getAttemptActivityChart(): Promise<ChartPoint[]> {
  const from = daysAgo(6);
  const rows = await Attempt.aggregate<{ _id: string; count: number }>([
    { $match: { startedAt: { $gte: from } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$startedAt" },
        },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const countByDay = new Map(rows.map((row) => [row._id, row.count]));
  const points: ChartPoint[] = [];

  for (let i = 6; i >= 0; i -= 1) {
    const date = daysAgo(i);
    const key = date.toISOString().slice(0, 10);
    points.push({
      name: DAY_NAMES[date.getDay()],
      value: countByDay.get(key) ?? 0,
    });
  }

  return points;
}

export async function getUserGrowthChart(): Promise<GrowthPoint[]> {
  const from = monthsAgo(7);
  const [studentRows, interviewerRows] = await Promise.all([
    User.aggregate<{ _id: { year: number; month: number }; count: number }>([
      { $match: { role: "student", createdAt: { $gte: from } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
    User.aggregate<{ _id: { year: number; month: number }; count: number }>([
      { $match: { role: "interviewer", createdAt: { $gte: from } } },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  const studentMap = new Map(
    studentRows.map((row) => [
      `${row._id.year}-${row._id.month}`,
      row.count,
    ]),
  );
  const interviewerMap = new Map(
    interviewerRows.map((row) => [
      `${row._id.year}-${row._id.month}`,
      row.count,
    ]),
  );

  const points: GrowthPoint[] = [];
  for (let i = 7; i >= 0; i -= 1) {
    const date = monthsAgo(i);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    points.push({
      name: MONTH_NAMES[date.getMonth()],
      students: studentMap.get(key) ?? 0,
      interviewers: interviewerMap.get(key) ?? 0,
    });
  }

  return points;
}

export async function getCodingLanguageChart(): Promise<ChartPoint[]> {
  const rows = await CodingSubmission.aggregate<{ _id: string; count: number }>(
    [
      { $match: { kind: "submit", finalized: true } },
      { $group: { _id: "$language", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ],
  );

  return rows.map((row) => ({
    name: row._id.charAt(0).toUpperCase() + row._id.slice(1),
    value: row.count,
  }));
}

export async function getSecurityStatusChart(): Promise<SecuritySegment[]> {
  const activeAttempts = await Attempt.find({ status: "in_progress" })
    .select("_id")
    .limit(200);

  if (!activeAttempts.length) {
    return [
      { label: "Safe", value: 100, color: "var(--success)" },
      { label: "Warnings", value: 0, color: "var(--warning)" },
      { label: "Violations", value: 0, color: "var(--danger)" },
    ];
  }

  const attemptIds = activeAttempts.map((attempt) => attempt._id);
  const events = await SecurityEvent.find({ attemptId: { $in: attemptIds } })
    .select("attemptId eventType")
    .limit(5000);

  const eventsByAttempt = new Map<string, Array<{ eventType: string }>>();
  for (const event of events) {
    const key = event.attemptId.toString();
    const bucket = eventsByAttempt.get(key) ?? [];
    bucket.push({ eventType: event.eventType });
    eventsByAttempt.set(key, bucket);
  }

  let safe = 0;
  let warnings = 0;
  let violations = 0;

  for (const attempt of activeAttempts) {
    const summary = buildSecuritySummary(
      eventsByAttempt.get(attempt._id.toString()) ?? [],
    );
    if (summary.riskLevel === "HIGH") violations += 1;
    else if (summary.riskLevel === "MEDIUM") warnings += 1;
    else safe += 1;
  }

  const total = Math.max(1, activeAttempts.length);
  return [
    {
      label: "Safe",
      value: formatPercent(safe, total),
      color: "var(--success)",
    },
    {
      label: "Warnings",
      value: formatPercent(warnings, total),
      color: "var(--warning)",
    },
    {
      label: "Violations",
      value: formatPercent(violations, total),
      color: "var(--danger)",
    },
  ];
}

export async function getRecentSecurityAlerts(limit = 8) {
  const events = await SecurityEvent.find()
    .sort({ timestamp: -1 })
    .limit(limit)
    .lean();

  if (!events.length) return [] as AdminSecurityAlert[];

  const userIds = [...new Set(events.map((event) => event.userId.toString()))];
  const assessmentIds = [
    ...new Set(events.map((event) => event.assessmentId.toString())),
  ];

  const [users, assessments] = await Promise.all([
    User.find({ _id: { $in: userIds } }).select("name"),
    Assessment.find({ _id: { $in: assessmentIds } }).select("title"),
  ]);

  const userMap = new Map(users.map((user) => [user._id.toString(), user.name]));
  const assessmentMap = new Map(
    assessments.map((assessment) => [assessment._id.toString(), assessment.title]),
  );

  return events.map((event) => ({
    id: event._id.toString(),
    type: event.eventType
      .toLowerCase()
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" "),
    severity: event.severity.toLowerCase(),
    student: userMap.get(event.userId.toString()) ?? "Unknown",
    assessment: assessmentMap.get(event.assessmentId.toString()) ?? "Unknown",
    time: new Date(event.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    timestamp: new Date(event.timestamp).toISOString(),
  }));
}

function buildMonitoringFlags(events: Array<{ eventType: string }>) {
  const types = new Set(events.map((event) => event.eventType));
  const flags: string[] = [];

  const faceOk =
    types.has("FACE_DETECTED") &&
    !types.has("NO_FACE_DETECTED") &&
    !types.has("MULTIPLE_FACES_DETECTED");
  flags.push(faceOk ? "FACE" : "FACE ⚠");

  const headWarn =
    types.has("HEAD_LOOKING_LEFT") ||
    types.has("HEAD_LOOKING_RIGHT") ||
    types.has("HEAD_LOOKING_UP") ||
    types.has("HEAD_LOOKING_DOWN") ||
    types.has("PROLONGED_LOOKING_AWAY") ||
    types.has("REPEATED_LOOKING_AWAY");
  flags.push(headWarn ? "HEAD ⚠" : "HEAD");

  const multi = types.has("MULTIPLE_FACES_DETECTED");
  flags.push(multi ? "MULTI ⚠" : "ALONE");

  const leave =
    types.has("TAB_SWITCH") ||
    types.has("WINDOW_BLUR") ||
    types.has("FULLSCREEN_EXIT");
  flags.push(leave ? "FOCUS ⚠" : "FOCUS");

  return flags;
}

function monitoringStatusFromRisk(
  riskLevel: "LOW" | "MEDIUM" | "HIGH",
): ActiveMonitoringSession["status"] {
  if (riskLevel === "HIGH") return "violation";
  if (riskLevel === "MEDIUM") return "warning";
  return "safe";
}

export async function getActiveMonitoringSessions(limit = 12) {
  const attempts = await Attempt.find({ status: "in_progress" })
    .sort({ startedAt: -1 })
    .limit(limit);

  if (!attempts.length) return [] as ActiveMonitoringSession[];

  const studentIds = [...new Set(attempts.map((a) => a.studentId.toString()))];
  const attemptIds = attempts.map((a) => a._id);

  const [students, events] = await Promise.all([
    User.find({ _id: { $in: studentIds } }).select("name"),
    SecurityEvent.find({ attemptId: { $in: attemptIds } })
      .select("attemptId eventType")
      .sort({ timestamp: -1 })
      .limit(5000),
  ]);

  const studentMap = new Map(students.map((s) => [s._id.toString(), s.name]));
  const eventsByAttempt = new Map<string, Array<{ eventType: string }>>();
  for (const event of events) {
    const key = event.attemptId.toString();
    const bucket = eventsByAttempt.get(key) ?? [];
    bucket.push({ eventType: event.eventType });
    eventsByAttempt.set(key, bucket);
  }

  const now = Date.now();
  return attempts.map((attempt) => {
    const attemptEvents = eventsByAttempt.get(attempt._id.toString()) ?? [];
    const summary = buildSecuritySummary(attemptEvents);
    return {
      attemptId: attempt._id.toString(),
      studentName: studentMap.get(attempt.studentId.toString()) ?? "Unknown",
      assessmentTitle: attempt.assessmentTitle,
      elapsedMs: Math.max(0, now - attempt.startedAt.getTime()),
      riskLevel: summary.riskLevel,
      violationCount: summary.totalViolations,
      flags: buildMonitoringFlags(attemptEvents),
      status: monitoringStatusFromRisk(summary.riskLevel),
    };
  });
}

export async function getMonitoringSummary() {
  const sessions = await getActiveMonitoringSessions(100);
  const safe = sessions.filter((s) => s.status === "safe").length;
  const warnings = sessions.filter((s) => s.status === "warning").length;
  const violations = sessions.filter((s) => s.status === "violation").length;

  return {
    activeSessions: sessions.length,
    safe,
    warnings,
    violations,
  };
}

export async function getMonitoringEventStream(limit = 30) {
  return getRecentSecurityAlerts(limit);
}

export type AdminStudentRow = {
  id: string;
  name: string;
  email: string;
  course: string;
  assessments: number;
  avgScore: number | null;
  violations: number;
  status: string;
  createdAt: string;
};

export async function listAdminStudents(options: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  const search = (options.search ?? "").trim();
  const status = options.status ?? "all";
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 20));

  const query: Record<string, unknown> = { role: "student" };
  if (status !== "all") query.status = status;
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { course: { $regex: search, $options: "i" } },
    ];
  }

  const skip = (page - 1) * pageSize;
  const [total, students] = await Promise.all([
    User.countDocuments(query),
    User.find(query)
      .select("name email course status createdAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize),
  ]);

  if (!students.length) {
    return { students: [] as AdminStudentRow[], total, page, pageSize, pageCount: 1 };
  }

  const studentIds = students.map((student) => student._id);

  const [attemptCounts, resultAgg, violationAgg] = await Promise.all([
    Attempt.aggregate<{ _id: typeof studentIds[number]; count: number }>([
      {
        $match: {
          studentId: { $in: studentIds },
          status: { $in: ["submitted", "expired"] },
        },
      },
      { $group: { _id: "$studentId", count: { $sum: 1 } } },
    ]),
    Result.aggregate<{
      _id: typeof studentIds[number];
      avgScore: number;
      count: number;
    }>([
      {
        $match: {
          studentId: { $in: studentIds },
          evaluationStatus: "completed",
          totalMarks: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: "$studentId",
          avgScore: { $avg: { $multiply: [{ $divide: ["$finalScore", "$totalMarks"] }, 100] } },
          count: { $sum: 1 },
        },
      },
    ]),
    SecurityEvent.aggregate<{ _id: typeof studentIds[number]; count: number }>([
      {
        $match: {
          userId: { $in: studentIds },
          eventType: { $in: [...SECURITY_VIOLATION_EVENT_TYPES] },
        },
      },
      { $group: { _id: "$userId", count: { $sum: 1 } } },
    ]),
  ]);

  const attemptMap = new Map(
    attemptCounts.map((row) => [row._id.toString(), row.count]),
  );
  const resultMap = new Map(
    resultAgg.map((row) => [row._id.toString(), Math.round(row.avgScore)]),
  );
  const violationMap = new Map(
    violationAgg.map((row) => [row._id.toString(), row.count]),
  );

  return {
    students: students.map((student) => ({
      id: student._id.toString(),
      name: student.name,
      email: student.email,
      course: student.course || "—",
      assessments: attemptMap.get(student._id.toString()) ?? 0,
      avgScore: resultMap.has(student._id.toString())
        ? (resultMap.get(student._id.toString()) ?? null)
        : null,
      violations: violationMap.get(student._id.toString()) ?? 0,
      status: student.status,
      createdAt: student.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export type AdminReportRow = {
  attemptId: string;
  studentName: string;
  studentEmail: string;
  assessmentTitle: string;
  status: string;
  evaluationStatus: string;
  finalScore: number | null;
  totalMarks: number;
  violationCount: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  submittedAt: string | null;
  startedAt: string;
};

export async function listAdminReports(options: {
  assessmentId?: string;
  studentId?: string;
  status?: string;
  evaluationStatus?: string;
  dateFrom?: string;
  dateTo?: string;
  riskLevel?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize ?? 20));
  const query: Record<string, unknown> = {};

  if (options.assessmentId && options.assessmentId !== "all") {
    query.assessmentId = options.assessmentId;
  }
  if (options.studentId && options.studentId !== "all") {
    query.studentId = options.studentId;
  }
  if (options.status && options.status !== "all") {
    query.status = options.status;
  }

  if (options.dateFrom || options.dateTo) {
    const submittedAt: Record<string, Date> = {};
    if (options.dateFrom) submittedAt.$gte = new Date(options.dateFrom);
    if (options.dateTo) {
      const end = new Date(options.dateTo);
      end.setHours(23, 59, 59, 999);
      submittedAt.$lte = end;
    }
    query.submittedAt = submittedAt;
  }

  if (options.evaluationStatus === "none") {
    query.status = "in_progress";
  } else if (
    options.evaluationStatus === "pending" ||
    options.evaluationStatus === "completed"
  ) {
    const matched = await Result.find({
      evaluationStatus: options.evaluationStatus,
    }).select("attemptId");
    query._id = { $in: matched.map((result) => result.attemptId) };
    if (options.status === "all" || !options.status) {
      query.status = { $in: ["submitted", "expired"] };
    }
  }

  const skip = (page - 1) * pageSize;
  const [total, attempts] = await Promise.all([
    Attempt.countDocuments(query),
    Attempt.find(query)
      .sort({ submittedAt: -1, startedAt: -1 })
      .skip(skip)
      .limit(pageSize),
  ]);

  if (!attempts.length) {
    return { rows: [] as AdminReportRow[], total, page, pageSize, pageCount: 1 };
  }

  const studentIds = [...new Set(attempts.map((a) => a.studentId.toString()))];
  const attemptIds = attempts.map((a) => a._id);

  const [students, results, events] = await Promise.all([
    User.find({ _id: { $in: studentIds } }).select("name email"),
    Result.find({ attemptId: { $in: attemptIds } }),
    SecurityEvent.find({ attemptId: { $in: attemptIds } }).select(
      "attemptId eventType",
    ),
  ]);

  const studentMap = new Map(students.map((s) => [s._id.toString(), s]));
  const resultMap = new Map(results.map((r) => [r.attemptId.toString(), r]));
  const eventsByAttempt = new Map<string, Array<{ eventType: string }>>();
  for (const event of events) {
    const key = event.attemptId.toString();
    const bucket = eventsByAttempt.get(key) ?? [];
    bucket.push({ eventType: event.eventType });
    eventsByAttempt.set(key, bucket);
  }

  const search = (options.search ?? "").trim().toLowerCase();
  let rows = attempts.map((attempt) => {
    const student = studentMap.get(attempt.studentId.toString());
    const result = resultMap.get(attempt._id.toString());
    const attemptEvents = eventsByAttempt.get(attempt._id.toString()) ?? [];
    const violationCount = countViolations(attemptEvents);
    const riskLevel = securityRiskLevelFromTotal(violationCount);
    const evaluationStatus =
      attempt.status === "in_progress"
        ? "none"
        : (result?.evaluationStatus ?? "pending");

    return {
      attemptId: attempt._id.toString(),
      studentName: student?.name ?? "Unknown",
      studentEmail: student?.email ?? "",
      assessmentTitle: attempt.assessmentTitle,
      status: attempt.status,
      evaluationStatus,
      finalScore: result?.finalScore ?? null,
      totalMarks: result?.totalMarks ?? attempt.totalMarks,
      violationCount,
      riskLevel,
      submittedAt: attempt.submittedAt
        ? attempt.submittedAt.toISOString()
        : null,
      startedAt: attempt.startedAt.toISOString(),
    };
  });

  if (options.riskLevel && options.riskLevel !== "all") {
    rows = rows.filter((row) => row.riskLevel === options.riskLevel);
  }

  if (search) {
    rows = rows.filter(
      (row) =>
        row.studentName.toLowerCase().includes(search) ||
        row.studentEmail.toLowerCase().includes(search) ||
        row.assessmentTitle.toLowerCase().includes(search),
    );
  }

  const filteredTotal =
    options.riskLevel && options.riskLevel !== "all"
      ? rows.length
      : total;

  return {
    rows,
    total: filteredTotal,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(filteredTotal / pageSize)),
  };
}

export async function getMonitoringSystemHealth() {
  const [activeAttempts, recordingEvents, violationEvents, cameraDenied] =
    await Promise.all([
      Attempt.countDocuments({ status: "in_progress" }),
      SecurityEvent.countDocuments({
        eventType: "RECORDING_STARTED",
        timestamp: { $gte: daysAgo(1) },
      }),
      SecurityEvent.countDocuments({
        eventType: { $in: [...SECURITY_VIOLATION_EVENT_TYPES] },
        timestamp: { $gte: daysAgo(1) },
      }),
      SecurityEvent.countDocuments({
        eventType: "CAMERA_PERMISSION_DENIED",
        timestamp: { $gte: daysAgo(1) },
      }),
    ]);

  const cameraBase = Math.max(1, recordingEvents + cameraDenied);
  return [
    ["Camera Streams", `${formatPercent(recordingEvents, cameraBase)}%`],
    ["Violations (24h)", String(violationEvents)],
    ["Active Attempts", String(activeAttempts)],
    ["Network", activeAttempts > 0 ? "Monitoring" : "Idle"],
  ] as const;
}
