"use server";

import mongoose from "mongoose";
import {
  buildAttemptReportCsv,
  buildAttemptReportPrintHtml,
} from "@/lib/admin/export";
import {
  getActiveMonitoringSessions,
  getMonitoringEventStream,
  getMonitoringSummary,
  getMonitoringSystemHealth,
  listAdminReports,
  listAdminStudents,
} from "@/lib/admin/queries";
import { ActionError, requireAdmin } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import {
  adminReportFilterSchema,
  adminStudentFilterSchema,
} from "@/lib/validators/admin";
import { Assessment } from "@/models/Assessment";
import { User } from "@/models/User";

export async function getAdminMonitoringAction() {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "MONITORING",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin monitoring");
    await connectDB();

    const [summary, sessions, events, systemHealth] = await Promise.all([
      getMonitoringSummary(),
      getActiveMonitoringSessions(12),
      getMonitoringEventStream(30),
      getMonitoringSystemHealth(),
    ]);

    return op.respond({
      summary,
      sessions,
      events,
      systemHealth,
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function listAdminStudentsAction(rawFilters?: unknown) {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "LIST_STUDENTS",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin list students");
    await connectDB();

    const filters = adminStudentFilterSchema.parse(rawFilters ?? {});
    const result = await listAdminStudents(filters);
    return op.respond(result);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function listAdminReportsAction(rawFilters?: unknown) {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "LIST_REPORTS",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin list reports");
    await connectDB();

    const filters = adminReportFilterSchema.parse(rawFilters ?? {});

    if (
      filters.assessmentId !== "all" &&
      !mongoose.Types.ObjectId.isValid(filters.assessmentId)
    ) {
      throw new ActionError("Invalid assessment filter.");
    }
    if (
      filters.studentId !== "all" &&
      !mongoose.Types.ObjectId.isValid(filters.studentId)
    ) {
      throw new ActionError("Invalid student filter.");
    }

    const result = await listAdminReports(filters);
    return op.respond(result);
  } catch (error) {
    return op.respondError(error);
  }
}

export async function listAdminReportFilterOptionsAction() {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "REPORT_FILTER_OPTIONS",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin report filter options");
    await connectDB();

    const [assessments, students] = await Promise.all([
      Assessment.find().select("title").sort({ title: 1 }),
      User.find({ role: "student" }).select("name email").sort({ name: 1 }),
    ]);

    return op.respond({
      assessments: assessments.map((assessment) => ({
        id: assessment._id.toString(),
        title: assessment.title,
      })),
      students: students.map((student) => ({
        id: student._id.toString(),
        name: student.name,
        email: student.email,
      })),
    });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function exportAdminReportsCsvAction(rawFilters?: unknown) {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "EXPORT_REPORTS_CSV",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin export reports csv");
    await connectDB();

    const filters = adminReportFilterSchema.parse(rawFilters ?? {});
    const result = await listAdminReports({
      ...filters,
      page: 1,
      pageSize: 1000,
    });

    if (!result.rows.length) {
      return op.respondError("No records match the selected filters.");
    }

    const csv = buildAttemptReportCsv(result.rows);
    const filename = `codeshield-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    return op.respond({ csv, filename, count: result.rows.length });
  } catch (error) {
    return op.respondError(error);
  }
}

export async function exportAdminReportsPdfAction(rawFilters?: unknown) {
  const op = createServerOp({
    domain: "ATTEMPT",
    operation: "EXPORT_REPORTS_PDF",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed("admin export reports pdf");
    await connectDB();

    const filters = adminReportFilterSchema.parse(rawFilters ?? {});
    const result = await listAdminReports({
      ...filters,
      page: 1,
      pageSize: 1000,
    });

    if (!result.rows.length) {
      return op.respondError("No records match the selected filters.");
    }

    const html = buildAttemptReportPrintHtml(
      result.rows,
      "CodeShield Assessment Report",
    );
    const filename = `codeshield-reports-${new Date().toISOString().slice(0, 10)}.html`;
    return op.respond({ html, filename, count: result.rows.length });
  } catch (error) {
    return op.respondError(error);
  }
}
