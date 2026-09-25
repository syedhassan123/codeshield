import { requireAdmin } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import { clientSafeErrorMessage, debugError, debugLog } from "@/lib/debug";
import {
  getActiveMonitoringSessions,
  getMonitoringEventStream,
  getMonitoringSummary,
  getMonitoringSystemHealth,
} from "@/lib/admin/queries";

/**
 * Live push feed for the Admin Monitoring Center.
 *
 * Server-Sent Events (native browser EventSource, no new dependency).
 * Auth is checked once when the connection opens (not per tick) to avoid
 * re-running the full auth/log pipeline every few seconds on a long-lived
 * connection. Data is re-read from MongoDB on a short server-side interval
 * and pushed to the client — no Mongo change streams (those require a
 * replica set, which a plain standalone MongoDB does not provide).
 */

export const dynamic = "force-dynamic";

const TICK_MS = 5000;

async function buildMonitoringPayload() {
  const [summary, sessions, events, systemHealth] = await Promise.all([
    getMonitoringSummary(),
    getActiveMonitoringSessions(12),
    getMonitoringEventStream(30),
    getMonitoringSystemHealth(),
  ]);
  return { summary, sessions, events, systemHealth };
}

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (error) {
    return new Response(
      JSON.stringify({ error: clientSafeErrorMessage(error) }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  await connectDB();
  debugLog("MONITORING", "SSE stream connected");

  const encoder = new TextEncoder();
  let closed = false;
  let interval: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          // Controller already closed by the runtime — ignore.
        }
      };

      const tick = async () => {
        if (closed) return;
        try {
          const payload = await buildMonitoringPayload();
          send("monitoring", payload);
        } catch (error) {
          debugError("MONITORING_STREAM_TICK_FAILED", error);
          // NOTE: must NOT be named "error" — EventSource treats any event
          // named "error" (including custom server-sent ones) as a
          // connection-level failure and fires source.onerror, which would
          // wrongly trigger the client's reconnect logic on a mere query
          // hiccup instead of an actual dropped connection.
          send("monitoring_error", { error: "Failed to load monitoring data." });
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        if (interval) clearInterval(interval);
        debugLog("MONITORING", "SSE stream closed");
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };

      req.signal.addEventListener("abort", close);

      await tick();
      if (closed) return;
      interval = setInterval(() => void tick(), TICK_MS);
    },
    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
