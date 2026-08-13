"use server";

import mongoose from "mongoose";
import { z } from "zod";
import { ActionError, requireAdmin, requireStudent } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { createServerOp, debugLog, isVerboseDebugEnabled, maskId } from "@/lib/debug";
import {
  buildSecuritySummary,
  isLeaveSecurityEvent,
  SECURITY_LEAVE_DEDUP_MS,
  severityForEventType,
} from "@/lib/exam/security";
import { ensureAttemptNotExpired, getOwnedAttempt } from "@/lib/exam/finalize";
import { Attempt } from "@/models/Attempt";
import { SecurityEvent } from "@/models/SecurityEvent";
import { SECURITY_EVENT_TYPES } from "@/types/exam-security";

const recordSchema = z.object({
  attemptId: z.string().min(1),
  eventType: z.enum(SECURITY_EVENT_TYPES),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

function securityLog(eventType: string, attemptId: string, status: string) {
  if (!isVerboseDebugEnabled()) return;
  console.log("");
  console.log("[EXAM SECURITY]");
  console.log(`Event: ${eventType}`);
  console.log(`Attempt: ${maskId(attemptId)}`);
  console.log("User: authenticated student");
  console.log(`Status: ${status}`);
  console.log("");
}

/**
 * Record a browser/exam security event for an active attempt.
 * Auth + ownership are derived from Auth.js session — never trust client claims.
 */
export async function recordExamSecurityEventAction(raw: unknown) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "SECURITY_EVENT",
    source: "SERVER-ACTION",
  });

  try {
    const session = await requireStudent();
    op.auth(session.user);

    const parsed = recordSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false as const, error: "Invalid security event." };
    }

    const { attemptId, eventType, metadata } = parsed.data;
    op.allowed({
      action: "record_security_event",
      resource: `attempt:${maskId(attemptId)}`,
      role: session.user.role,
    });

    await connectDB();
    const attempt = await getOwnedAttempt(attemptId, session.user.id);
    const live = await ensureAttemptNotExpired(attempt);

    if (live.status !== "in_progress") {
      securityLog(eventType, attemptId, "REJECTED_ATTEMPT_CLOSED");
      return {
        success: false as const,
        error: "Exam attempt is no longer active.",
      };
    }

    // Server-side dedup for leave-style events (visibility + blur double-fire).
    if (isLeaveSecurityEvent(eventType)) {
      const since = new Date(Date.now() - SECURITY_LEAVE_DEDUP_MS);
      const recentLeave = await SecurityEvent.findOne({
        attemptId: live._id,
        eventType: { $in: ["TAB_SWITCH", "WINDOW_BLUR"] },
        timestamp: { $gte: since },
      })
        .sort({ timestamp: -1 })
        .lean();

      const recentFullscreen = await SecurityEvent.findOne({
        attemptId: live._id,
        eventType: "FULLSCREEN_EXIT",
        timestamp: { $gte: since },
      })
        .sort({ timestamp: -1 })
        .lean();

      const isTabFamily =
        eventType === "TAB_SWITCH" || eventType === "WINDOW_BLUR";

      if (isTabFamily && recentLeave) {
        securityLog(eventType, attemptId, "DEDUPED");
        debugLog("EXAM", "SECURITY_EVENT_DEDUPED", {
          eventType,
          attemptId: maskId(attemptId),
        });
        return { success: true as const, deduped: true as const };
      }

      if (eventType === "FULLSCREEN_EXIT" && recentFullscreen) {
        securityLog(eventType, attemptId, "DEDUPED");
        debugLog("EXAM", "SECURITY_EVENT_DEDUPED", {
          eventType,
          attemptId: maskId(attemptId),
        });
        return { success: true as const, deduped: true as const };
      }
    }

    const severity = severityForEventType(eventType);
    const safeMeta =
      metadata && typeof metadata === "object"
        ? Object.fromEntries(
            Object.entries(metadata).filter(
              ([k]) =>
                !/pass(word)?|token|secret|cookie|auth|mongo|smtp|api[_-]?key/i.test(
                  k,
                ),
            ),
          )
        : {};

    await SecurityEvent.create({
      attemptId: live._id,
      userId: live.studentId,
      assessmentId: live.assessmentId,
      eventType,
      severity,
      timestamp: new Date(),
      metadata: safeMeta,
    });

    securityLog(eventType, attemptId, "RECORDED");
    debugLog("EXAM", "SECURITY_EVENT_RECORDED", {
      eventType,
      severity,
      attemptId: maskId(attemptId),
    });

    op.success({ eventType, severity });
    return { success: true as const };
  } catch (error) {
    op.fail(error);
    if (error instanceof ActionError) {
      return { success: false as const, error: error.message };
    }
    return { success: false as const, error: "Unauthorized" };
  }
}

export type SerializedSecurityEvent = {
  id: string;
  eventType: string;
  severity: string;
  timestamp: string;
  metadata: Record<string, unknown>;
};

/** Admin-only security report for an attempt (summary + timeline). */
export async function getAttemptSecurityReportAction(attemptId: string) {
  const op = createServerOp({
    domain: "EXAM",
    operation: "SECURITY_REPORT",
    source: "SERVER-ACTION",
    resourceId: attemptId,
  });

  try {
    const session = await requireAdmin();
    op.auth(session.user);
    op.allowed({
      action: "view_security_events",
      resource: `attempt:${maskId(attemptId)}`,
      role: session.user.role,
    });

    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(attemptId)) {
      throw new ActionError("Attempt not found.");
    }

    const attempt = await Attempt.findById(attemptId).select("_id");
    if (!attempt) throw new ActionError("Attempt not found.");

    const events = await SecurityEvent.find({ attemptId: attempt._id })
      .sort({ timestamp: 1 })
      .lean();

    const serialized: SerializedSecurityEvent[] = events.map((e) => ({
      id: e._id.toString(),
      eventType: e.eventType,
      severity: e.severity,
      timestamp: new Date(e.timestamp).toISOString(),
      metadata:
        e.metadata && typeof e.metadata === "object"
          ? (e.metadata as Record<string, unknown>)
          : {},
    }));

    const summary = buildSecuritySummary(serialized);

    return op.respond(
      {
        summary,
        events: serialized,
      },
      200,
    );
  } catch (error) {
    return op.respondError(error, 400);
  }
}
