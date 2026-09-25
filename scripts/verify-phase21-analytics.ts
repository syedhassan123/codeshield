/**
 * Phase 21 checks: /admin/analytics reads real MongoDB series instead of
 * rendering the chart components with no data (permanent empty states).
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase21-analytics.ts
 */
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import {
  getSecurityEventTrendChart,
  getSkillDistributionChart,
  getUserGrowthChart,
  getWeeklyPerformanceChart,
} from "../src/lib/admin/queries";
import { Assessment } from "../src/models/Assessment";
import { Result } from "../src/models/Result";
import { SecurityEvent } from "../src/models/SecurityEvent";
import { User } from "../src/models/User";
import { SECURITY_VIOLATION_EVENT_TYPES } from "../src/types/exam-security";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function startOfWeek(date: Date) {
  const next = startOfDay(date);
  next.setDate(next.getDate() - next.getDay());
  return next;
}

function staticChecks() {
  const page = read("src/app/admin/analytics/page.tsx");
  assert(
    page.includes('requirePageRole(["admin"])'),
    "analytics page is admin-gated",
  );
  assert(page.includes("connectDB"), "analytics page loads from MongoDB");
  for (const fn of [
    "getWeeklyPerformanceChart",
    "getSkillDistributionChart",
    "getUserGrowthChart",
    "getCodingLanguageChart",
    "getSecurityEventTrendChart",
  ]) {
    assert(page.includes(fn), `analytics page calls ${fn}`);
  }
  assert(
    !page.includes("<ActivityAreaChart />") &&
      !page.includes("<LanguageBarChart />") &&
      !page.includes("<GrowthBarChart />"),
    "charts receive data props instead of rendering empty",
  );
}

async function dbChecks() {
  await connectDB();

  const student = await User.findOne({ email: "rohan@codeshield.edu" });
  assert(student, "seed student exists");
  const assessment = await Assessment.findOne({ code: "ASM-201" });
  assert(assessment, "published ASM-201 exists");

  const weekStart = startOfWeek(new Date());
  weekStart.setDate(weekStart.getDate() - 21);
  const submittedAt = new Date(weekStart);
  submittedAt.setHours(12, 0, 0, 0);

  const result = await Result.create({
    attemptId: new mongoose.Types.ObjectId(),
    studentId: student!._id,
    assessmentId: assessment!._id,
    assessmentTitle: assessment!.title,
    objectiveScore: 40,
    objectiveMaxMarks: 100,
    subjectiveScore: 0,
    subjectiveMaxMarks: 0,
    codingScore: 0,
    codingMaxMarks: 0,
    subjectivePendingCount: 0,
    finalScore: 40,
    totalMarks: 100,
    evaluationStatus: "completed",
    questions: [],
    submittedAt,
    finalizedReason: "submitted",
  });

  const event = await SecurityEvent.create({
    attemptId: new mongoose.Types.ObjectId(),
    userId: student!._id,
    assessmentId: assessment!._id,
    eventType: "TAB_SWITCH",
    severity: "MEDIUM",
    timestamp: new Date(),
  });

  try {
    const performance = await getWeeklyPerformanceChart();
    assert(performance.length === 8, "performance trend covers 8 weeks");

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekResults = await Result.find({
      evaluationStatus: "completed",
      totalMarks: { $gt: 0 },
      submittedAt: { $gte: weekStart, $lt: weekEnd },
    }).select("finalScore totalMarks");
    const expectedAvg = Math.round(
      weekResults.reduce(
        (sum, row) => sum + (row.finalScore / row.totalMarks) * 100,
        0,
      ) / weekResults.length,
    );
    assert(
      performance[4]?.value === expectedAvg,
      "the week 3 weeks ago matches the real average completed score",
    );

    const skills = await getSkillDistributionChart();
    const titled = await Result.find({
      evaluationStatus: "completed",
      totalMarks: { $gt: 0 },
      assessmentTitle: assessment!.title,
    }).select("finalScore totalMarks");
    const titleAvg = Math.round(
      titled.reduce(
        (sum, row) => sum + (row.finalScore / row.totalMarks) * 100,
        0,
      ) / titled.length,
    );
    const skillPoint = skills.find((point) => point.name === assessment!.title);
    assert(
      skillPoint?.value === titleAvg,
      "skill distribution matches the real average for that assessment title",
    );

    const growth = await getUserGrowthChart();
    assert(growth.length === 8, "user growth covers 8 months");
    assert(
      growth.every(
        (point) =>
          Number.isFinite(point.students) && Number.isFinite(point.interviewers),
      ),
      "user growth points are real counts",
    );

    const today = startOfDay(new Date());
    const violationCount = await SecurityEvent.countDocuments({
      eventType: { $in: [...SECURITY_VIOLATION_EVENT_TYPES] },
      timestamp: { $gte: today },
    });
    const security = await getSecurityEventTrendChart();
    assert(security.length === 7, "security trend covers 7 days");
    assert(
      security[6]?.value === violationCount,
      "today's security point matches the real violation count",
    );
    assert(violationCount >= 1, "the fixture violation is included in today's count");
  } finally {
    await Result.deleteMany({ _id: result._id });
    await SecurityEvent.deleteMany({ _id: event._id });
  }
}

async function main() {
  console.log("Phase 21 admin analytics verification\n");
  staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 21 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
