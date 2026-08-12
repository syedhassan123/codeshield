/**
 * Centralized server-side debug logger.
 *
 * Enabled when NODE_ENV === "development" OR DEBUG_LOGS === "true".
 * Forced off when DEBUG_LOGS === "false".
 *
 * Never log passwords, tokens, cookies, Mongo URIs, or secrets.
 * Only [API RESPONSE] logs the actual return body as an expandable object
 * (console.log(object) — not a raw JSON string wall).
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";

export type LogPrefix =
  | "AUTH"
  | "AUTHORIZATION"
  | "ASSESSMENT"
  | "QUESTION"
  | "EXAM"
  | "ANSWER"
  | "RESULT"
  | "ATTEMPT"
  | "GRADING"
  | "SCORE"
  | "CODING"
  | "SUBMISSION"
  | "CODE-RUNNER"
  | "TEST-CASE"
  | "MONGODB"
  | "DB"
  | "DATABASE"
  | "SERVER-ACTION"
  | "SERVER-COMPONENT"
  | "API"
  | "HTTP"
  | "ERROR"
  | "SESSION";

type DetailValue = string | number | boolean | null | undefined;
export type LogDetails = Record<string, DetailValue>;

type RequestLogContext = {
  requestId: string;
  startedAt: number;
  authLogged: boolean;
  authzLogged: boolean;
  lastAuthzAction?: string;
  mongoReuseLogged: boolean;
  role?: string;
  route?: string;
  responseLogged: boolean;
};

const requestAls = new AsyncLocalStorage<RequestLogContext>();

const SENSITIVE_KEY =
  /pass(word)?|token|secret|authorization|cookie|mongo(db)?_?uri|api[_-]?key|private|credential|otp|hash|salt/i;

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

export function isVerboseDebugEnabled() {
  if (process.env.DEBUG_LOGS === "false") return false;
  if (process.env.DEBUG_LOGS === "true") return true;
  return process.env.NODE_ENV === "development";
}

export function isResponseBodyLoggingEnabled() {
  if (!isVerboseDebugEnabled()) return false;
  if (process.env.DEBUG_API_BODY === "false") return false;
  if (
    process.env.NODE_ENV === "production" &&
    process.env.DEBUG_API_BODY !== "true"
  ) {
    return false;
  }
  return true;
}

export function maskEmail(email?: string | null) {
  if (!email) return "unknown";
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  return `${user.slice(0, 1)}***@${domain}`;
}

export function maskId(id?: string | null) {
  if (!id) return "unknown";
  if (id.length <= 8) return `${id.slice(0, 2)}***`;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function newRequestId() {
  return `req_${randomBytes(3).toString("hex")}`;
}

function getCtx(): RequestLogContext | undefined {
  return requestAls.getStore();
}

export function getRequestId() {
  return getCtx()?.requestId;
}

function out(...lines: string[]) {
  if (!isVerboseDebugEnabled()) return;
  for (const line of lines) console.log(line);
}

function printBlock(title: string, fields: Array<[string, DetailValue]>) {
  if (!isVerboseDebugEnabled()) return;
  console.log("");
  console.log(`[${title}]`);
  for (const [key, value] of fields) {
    if (value === undefined || value === "") continue;
    console.log(`${key}: ${String(value)}`);
  }
}

/** Start or reuse request-scoped logging context (survives awaits). */
export function beginRequestLog(_meta?: {
  label?: string;
  source?: "SERVER-ACTION" | "SERVER-COMPONENT" | "API";
}) {
  const existing = getCtx();
  if (existing) return existing;

  const ctx: RequestLogContext = {
    requestId: newRequestId(),
    startedAt: Date.now(),
    authLogged: false,
    authzLogged: false,
    mongoReuseLogged: false,
    responseLogged: false,
  };
  requestAls.enterWith(ctx);
  return ctx;
}

export function logApiRequest(options: {
  method?: string;
  route: string;
  resourceId?: string;
}) {
  const ctx = getCtx() ?? beginRequestLog();
  ctx.route = options.route;
  const method = options.method || "ACTION";

  out("");
  out(DIVIDER);
  out("[API REQUEST]");
  out(`Method: ${method}`);
  out(`Route: ${options.route}`);
  if (options.resourceId) out(`Resource: ${maskId(options.resourceId)}`);
  out(`Request ID: ${ctx.requestId}`);
  out(DIVIDER);
}

/** Compatibility helper used by older call sites. */
export function debugLog(
  prefix: LogPrefix,
  message: string,
  meta?: Record<string, unknown>,
) {
  if (!isVerboseDebugEnabled()) return;
  const ctx = getCtx();
  const bits = [`[${prefix === "MONGODB" ? "DB" : prefix}] ${message}`];
  if (ctx?.requestId) bits.push(`requestId=${ctx.requestId}`);
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      if (SENSITIVE_KEY.test(k)) {
        bits.push(`${k}=[REDACTED]`);
        continue;
      }
      bits.push(`${k}=${String(v)}`);
    }
  }
  console.log(bits.join(" | "));
}

export function debugBlock(
  prefix: LogPrefix,
  title: string,
  details: LogDetails = {},
) {
  printBlock(prefix === "MONGODB" ? "DB" : prefix, [
    ["Event", title],
    ...Object.entries(details),
    ["Request ID", getCtx()?.requestId],
  ]);
}

export function debugError(
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
) {
  if (!isVerboseDebugEnabled()) return;
  const fields: Array<[string, DetailValue]> = [
    ["Event", message],
    ["Request ID", getCtx()?.requestId],
    ["User Role", getCtx()?.role],
  ];
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      fields.push([
        k,
        SENSITIVE_KEY.test(k)
          ? "[REDACTED]"
          : typeof v === "string" ||
              typeof v === "number" ||
              typeof v === "boolean" ||
              v === null
            ? v
            : String(v),
      ]);
    }
  }
  if (error instanceof Error) fields.push(["Error", error.message]);
  else if (error != null) fields.push(["Error", String(error)]);

  printBlock("ERROR", fields);
  if (
    error instanceof Error &&
    error.stack &&
    process.env.DEBUG_STACK !== "false"
  ) {
    console.error(error.stack);
  }
}

type AuthUserLike = {
  id?: string;
  email?: string | null;
  role?: string;
};

export function logAuthOnce(
  user?: AuthUserLike | null,
  _message = "User authenticated",
) {
  const ctx = getCtx() ?? beginRequestLog();
  if (ctx.authLogged) return;
  ctx.authLogged = true;
  ctx.role = (user?.role || "anonymous").toUpperCase();

  printBlock("AUTH", [
    ["Status", user?.id ? "AUTHENTICATED" : "ANONYMOUS"],
    ["User", maskEmail(user?.email)],
    ["Role", ctx.role],
    ["User ID", maskId(user?.id)],
    ["Request ID", ctx.requestId],
  ]);
}

export function logSessionOnce(user?: AuthUserLike | null) {
  logAuthOnce(user);
}

export function logAuthorization(options: {
  allowed: boolean;
  action: string;
  resource?: string;
  role?: string;
  reason?: string;
}) {
  const ctx = getCtx() ?? beginRequestLog();
  if (
    options.allowed &&
    ctx.authzLogged &&
    ctx.lastAuthzAction === options.action
  ) {
    return;
  }
  if (options.allowed) {
    ctx.authzLogged = true;
    ctx.lastAuthzAction = options.action;
  }

  printBlock("AUTHORIZATION", [
    ["Status", options.allowed ? "ALLOWED" : "DENIED"],
    ["Role", (options.role || ctx.role || "anonymous").toUpperCase()],
    ["Action", options.action],
    ["Resource", options.resource],
    ["Reason", options.reason],
    ["Request ID", ctx.requestId],
  ]);
}

export function logMongoConnected(durationMs: number) {
  printBlock("DATABASE", [
    ["Operation", "CONNECT"],
    ["Status", "SUCCESS"],
    ["Duration", `${durationMs}ms`],
    ["Request ID", getCtx()?.requestId],
  ]);
}

export function logMongoReused() {
  const ctx = getCtx();
  if (ctx) {
    if (ctx.mongoReuseLogged) return;
    ctx.mongoReuseLogged = true;
  }
  // Keep quiet — one short line only (avoid drowning the request flow).
  if (!isVerboseDebugEnabled()) return;
  console.log(
    `[DATABASE] connection reused | requestId=${ctx?.requestId ?? "n/a"}`,
  );
}

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (/^e-?mail$/i.test(key) && typeof value === "string") {
    return maskEmail(value);
  }
  if (Array.isArray(value)) {
    if (value.length > 40) {
      return [
        ...value.slice(0, 40).map((item, i) => redactValue(String(i), item)),
        `…(+${value.length - 40} more)`,
      ];
    }
    return value.map((item, i) => redactValue(String(i), item));
  }
  if (value && typeof value === "object") {
    const outObj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      outObj[k] = redactValue(k, v);
    }
    return outObj;
  }
  if (typeof value === "string" && value.length > 4000) {
    return `${value.slice(0, 4000)}…[truncated]`;
  }
  return value;
}

export function redactForLog(payload: unknown): unknown {
  if (payload == null) return payload;
  if (typeof payload !== "object") return payload;
  return redactValue("root", payload);
}

/**
 * Pretty-print the ACTUAL response body returned to the client.
 * Call this with the same object you return from the server action / route.
 */
export function logApiResponse(options: {
  status: number;
  durationMs: number;
  body: unknown;
  method?: string;
  path?: string;
}) {
  if (!isVerboseDebugEnabled()) return;
  const ctx = getCtx();
  if (ctx) ctx.responseLogged = true;

  out("");
  out(DIVIDER);
  out("[API RESPONSE]");
  out(`Request ID: ${ctx?.requestId ?? "n/a"}`);
  out(`Status: ${options.status}`);
  out(`Duration: ${options.durationMs}ms`);
  if (options.path) out(`Route: ${options.path}`);
  out("");

  if (!isResponseBodyLoggingEnabled()) {
    out("(response body logging disabled — set DEBUG_API_BODY=true)");
    out(DIVIDER);
    out("");
    return;
  }

  try {
    // Log as a real object so browser DevTools shows a collapsible ▶ Object
    // (NOT JSON.stringify — that prints an unreadable text wall).
    const redacted = redactForLog(options.body);
    console.log("[API RESPONSE] body ▶", redacted);
  } catch {
    console.log("[API RESPONSE] body ▶", "[unserializable response body]");
  }

  out(DIVIDER);
  out("");
}

export function createServerOp(options: {
  domain: Extract<
    LogPrefix,
    | "ASSESSMENT"
    | "QUESTION"
    | "AUTH"
    | "SESSION"
    | "EXAM"
    | "ANSWER"
    | "RESULT"
    | "ATTEMPT"
    | "GRADING"
    | "SCORE"
    | "CODING"
    | "SUBMISSION"
  >;
  operation: string;
  source?: "SERVER-ACTION" | "SERVER-COMPONENT" | "API";
  resourceId?: string;
}) {
  const { domain, operation, source = "SERVER-ACTION", resourceId } = options;
  const route = `${domain}.${operation}`;
  const ctx = beginRequestLog({ label: route, source });
  const startedAt = Date.now();

  logApiRequest({
    method: source === "API" ? "HTTP" : source === "SERVER-COMPONENT" ? "PAGE" : "ACTION",
    route,
    resourceId,
  });

  return {
    requestId: ctx.requestId,

    auth(user?: AuthUserLike | null) {
      logAuthOnce(user);
    },

    allowed(
      detailOrAction?:
        | string
        | {
            action: string;
            resource?: string;
            role?: string;
          },
    ) {
      if (typeof detailOrAction === "string" || detailOrAction == null) {
        logAuthorization({
          allowed: true,
          action: detailOrAction || operation.toLowerCase(),
          resource: resourceId
            ? `${domain.toLowerCase()}:${maskId(resourceId)}`
            : undefined,
        });
        return;
      }
      logAuthorization({
        allowed: true,
        action: detailOrAction.action,
        resource: detailOrAction.resource,
        role: detailOrAction.role,
      });
    },

    denied(
      detailOrOpts?:
        | string
        | {
            action?: string;
            resource?: string;
            role?: string;
            reason?: string;
          },
    ) {
      if (typeof detailOrOpts === "string" || detailOrOpts == null) {
        logAuthorization({
          allowed: false,
          action: operation.toLowerCase(),
          reason: detailOrOpts || "DENIED",
          resource: resourceId
            ? `${domain.toLowerCase()}:${maskId(resourceId)}`
            : undefined,
        });
        return;
      }
      logAuthorization({
        allowed: false,
        action: detailOrOpts.action || operation.toLowerCase(),
        resource: detailOrOpts.resource,
        role: detailOrOpts.role,
        reason: detailOrOpts.reason || "DENIED",
      });
    },

    mongo(message: string, meta?: Record<string, unknown>) {
      debugLog("DATABASE", message, meta);
    },

    async runMongo<T>(label: string, fn: () => Promise<T>): Promise<T> {
      const t0 = Date.now();
      const opName = label
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      try {
        const result = await fn();
        printBlock("DATABASE", [
          ["Operation", opName || label],
          ["Resource", resourceId ? maskId(resourceId) : undefined],
          ["Status", "SUCCESS"],
          ["Duration", `${Date.now() - t0}ms`],
          ["Request ID", ctx.requestId],
        ]);
        return result;
      } catch (error) {
        printBlock("DATABASE", [
          ["Operation", opName || label],
          ["Resource", resourceId ? maskId(resourceId) : undefined],
          ["Status", "FAILED"],
          ["Duration", `${Date.now() - t0}ms`],
          ["Request ID", ctx.requestId],
        ]);
        debugError(`DB_${operation}_FAILED`, error, { op: label });
        throw error;
      }
    },

    summary(details: LogDetails = {}) {
      printBlock(domain, [
        ["Event", operation],
        ...Object.entries(details),
        ["Duration", `${Date.now() - startedAt}ms`],
        ["Request ID", ctx.requestId],
      ]);
    },

    /**
     * Log the ACTUAL response body and return it unchanged.
     * Always prefer this over success()+return separately.
     */
    respond<T>(body: T, status = 200): T {
      logApiResponse({
        status,
        durationMs: Date.now() - startedAt,
        path: route,
        body,
      });
      return body;
    },

    /**
     * Log an error response body and return it (for action `{ error }` returns).
     */
    respondError(error: unknown, status = 400): { error: string } {
      const message =
        typeof error === "string"
          ? error
          : error instanceof Error
            ? error.message
            : "Something went wrong.";
      const body = { success: false as const, error: message };
      debugError(`${domain}_${operation}_FAILED`, error, {
        resourceId: resourceId ? maskId(resourceId) : undefined,
      });
      logApiResponse({
        status,
        durationMs: Date.now() - startedAt,
        path: route,
        body,
      });
      return { error: message };
    },

    /** @deprecated Prefer respond(actualBody). Keeps older call sites working. */
    success(meta?: Record<string, unknown>, responseBody?: unknown) {
      if (responseBody !== undefined) {
        logApiResponse({
          status: 200,
          durationMs: Date.now() - startedAt,
          path: route,
          body: responseBody,
        });
        return;
      }
      // No body provided — do NOT invent JSON. Just a short success line.
      if (!ctx.responseLogged) {
        console.log(
          `[${domain}] SUCCESS | duration=${Date.now() - startedAt}ms | requestId=${ctx.requestId}${
            meta
              ? " | " +
                Object.entries(meta)
                  .map(([k, v]) => `${k}=${String(v)}`)
                  .join(" ")
              : ""
          }`,
        );
      }
    },

    fail(error: unknown, meta?: Record<string, unknown>) {
      // Prefer respondError at call sites; this keeps older catch blocks working.
      if (!ctx.responseLogged) {
        this.respondError(
          typeof error === "string"
            ? error
            : error instanceof Error
              ? error
              : meta?.resourceId
                ? String(error)
                : error,
          400,
        );
      } else {
        debugError(`${domain}_${operation}_FAILED`, error, meta);
      }
    },

    logResponse(status: number, body?: unknown) {
      logApiResponse({
        status,
        durationMs: Date.now() - startedAt,
        path: route,
        body: body ?? null,
      });
    },

    durationMs() {
      return Date.now() - startedAt;
    },
  };
}
