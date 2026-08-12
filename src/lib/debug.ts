/**
 * Structured development logger.
 *
 * Enabled when NODE_ENV === "development" OR DEBUG_LOGS === "true".
 * Forced off when DEBUG_LOGS === "false".
 *
 * Never log passwords, tokens, cookies, Mongo URIs, or secrets.
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
  summarized: boolean;
};

const requestAls = new AsyncLocalStorage<RequestLogContext>();

const SENSITIVE_KEY =
  /pass(word)?|token|secret|authorization|cookie|mongo(db)?_?uri|api[_-]?key|private|credential|otp|hash|salt/i;

export function isVerboseDebugEnabled() {
  if (process.env.DEBUG_LOGS === "false") return false;
  if (process.env.DEBUG_LOGS === "true") return true;
  return process.env.NODE_ENV === "development";
}

export function isResponseBodyLoggingEnabled() {
  if (!isVerboseDebugEnabled()) return false;
  if (process.env.DEBUG_API_BODY === "false") return false;
  // Detailed response bodies only in debug mode (never production unless forced).
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_API_BODY !== "true") {
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

function displayPrefix(prefix: LogPrefix): Exclude<LogPrefix, "MONGODB"> {
  if (prefix === "MONGODB") return "DB";
  return prefix;
}

function getCtx(): RequestLogContext | undefined {
  return requestAls.getStore();
}

export function getRequestId() {
  return getCtx()?.requestId;
}

/** Start or reuse a request-scoped logging context (survives awaits). */
export function beginRequestLog(meta?: {
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
    lastAuthzAction: undefined,
    mongoReuseLogged: false,
    summarized: false,
  };
  requestAls.enterWith(ctx);

  if (meta?.label) {
    writeLine("API", meta.label, { requestId: ctx.requestId });
  }

  return ctx;
}

function writeLine(
  prefix: LogPrefix,
  message: string,
  inline?: LogDetails,
  details?: LogDetails,
) {
  if (!isVerboseDebugEnabled()) return;

  const ctx = getCtx();
  const parts = [`[${displayPrefix(prefix)}] ${message}`];

  const inlinePairs = { ...(inline || {}) };
  if (ctx?.requestId && inlinePairs.requestId == null) {
    inlinePairs.requestId = ctx.requestId;
  }

  const inlineText = Object.entries(inlinePairs)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
  if (inlineText) parts.push(inlineText);

  console.log(parts.join(" | "));

  if (details && Object.keys(details).length) {
    for (const [k, v] of Object.entries(details)) {
      if (v === undefined) continue;
      // requestId already appears on the summary line.
      if (k === "requestId") continue;
      console.log(`  ${k}=${String(v)}`);
    }
  }
}

export function debugLog(
  prefix: LogPrefix,
  message: string,
  meta?: Record<string, unknown>,
) {
  if (!isVerboseDebugEnabled()) return;
  const details: LogDetails = {};
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      if (SENSITIVE_KEY.test(k)) {
        details[k] = "[REDACTED]";
        continue;
      }
      if (
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null
      ) {
        details[k] = v;
      } else {
        details[k] = String(v);
      }
    }
  }

  // Prefer compact single-line when few fields; otherwise summary + indent.
  const keys = Object.keys(details);
  if (keys.length <= 3) {
    writeLine(prefix, message, details);
  } else {
    writeLine(prefix, message, undefined, details);
  }
}

export function debugBlock(
  prefix: LogPrefix,
  title: string,
  details: LogDetails = {},
) {
  if (!isVerboseDebugEnabled()) return;
  writeLine(prefix, title, undefined, details);
}

export function debugError(
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
) {
  if (!isVerboseDebugEnabled()) return;

  const details: LogDetails = {
    requestId: getCtx()?.requestId,
    userRole: getCtx()?.role,
  };
  if (meta) {
    for (const [k, v] of Object.entries(meta)) {
      if (v === undefined) continue;
      if (SENSITIVE_KEY.test(k)) {
        details[k] = "[REDACTED]";
        continue;
      }
      details[k] =
        typeof v === "string" ||
        typeof v === "number" ||
        typeof v === "boolean" ||
        v === null
          ? v
          : String(v);
    }
  }

  if (error instanceof Error) {
    details.error = error.message;
  } else if (typeof error === "string") {
    details.error = error;
  } else if (error != null) {
    details.error = String(error);
  }

  writeLine("ERROR", message, undefined, details);

  if (error instanceof Error && error.stack && process.env.DEBUG_STACK !== "false") {
    console.error(error.stack);
  }
}

type AuthUserLike = {
  id?: string;
  email?: string | null;
  role?: string;
};

/** Log AUTH once per request. */
export function logAuthOnce(user?: AuthUserLike | null, message = "User authenticated") {
  const ctx = getCtx() ?? beginRequestLog();
  if (ctx.authLogged) return;
  ctx.authLogged = true;
  ctx.role = (user?.role || "anonymous").toUpperCase();

  debugBlock("AUTH", message, {
    requestId: ctx.requestId,
    role: ctx.role,
    userId: maskId(user?.id),
    email: maskEmail(user?.email),
  });
}

/** Log SESSION retrieval once (alias tone for page loads). */
export function logSessionOnce(user?: AuthUserLike | null) {
  const ctx = getCtx() ?? beginRequestLog();
  if (ctx.authLogged) return;
  logAuthOnce(user, "Session retrieved");
}

export function logAuthorization(options: {
  allowed: boolean;
  action: string;
  resource?: string;
  role?: string;
  reason?: string;
}) {
  const ctx = getCtx() ?? beginRequestLog();
  // DENIED always logs. ALLOWED logs once per distinct action in the request.
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

  debugBlock(
    "AUTHORIZATION",
    options.allowed ? "ALLOWED" : "DENIED",
    {
      requestId: ctx.requestId,
      role: (options.role || ctx.role || "anonymous").toUpperCase(),
      action: options.action,
      resource: options.resource,
      reason: options.reason,
    },
  );
}

export function logMongoConnected(durationMs: number) {
  writeLine("DB", "MongoDB connected", { duration: `${durationMs}ms` });
}

export function logMongoReused() {
  const ctx = getCtx();
  if (ctx) {
    if (ctx.mongoReuseLogged) return;
    ctx.mongoReuseLogged = true;
  }
  writeLine("DB", "MongoDB connection reused");
}

function redactValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEY.test(key)) return "[REDACTED]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item, i) => redactValue(String(i), item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = redactValue(k, v);
    }
    return out;
  }
  if (typeof value === "string" && value.length > 2000) {
    return `${value.slice(0, 2000)}…[truncated]`;
  }
  return value;
}

export function redactForLog(payload: unknown): unknown {
  if (payload == null) return payload;
  if (typeof payload !== "object") return payload;
  return redactValue("root", payload);
}

/** Pretty-print API/server-action response bodies (debug mode only). */
export function logApiResponse(options: {
  status: number;
  durationMs: number;
  body?: unknown;
  method?: string;
  path?: string;
}) {
  if (!isVerboseDebugEnabled()) return;

  writeLine("API", "RESPONSE", {
    status: options.status,
    duration: `${options.durationMs}ms`,
    requestId: getCtx()?.requestId,
  });

  if (!isResponseBodyLoggingEnabled() || options.body === undefined) return;

  try {
    const redacted = redactForLog(options.body);
    console.log(JSON.stringify(redacted, null, 2));
  } catch {
    console.log("[unserializable response body]");
  }
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
  const label = `${domain}.${operation}`;
  const ctx = beginRequestLog({
    label:
      source === "SERVER-COMPONENT"
        ? `PAGE ${label}`
        : source === "API"
          ? `API ${label}`
          : `ACTION ${label}`,
    source,
  });
  const startedAt = ctx.startedAt;

  if (resourceId) {
    writeLine(domain, operation, {
      resourceId: maskId(resourceId),
    });
  }

  let responseLogged = false;

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
      debugLog("DB", message, meta);
    },

    async runMongo<T>(label: string, fn: () => Promise<T>): Promise<T> {
      const t0 = Date.now();
      try {
        const result = await fn();
        writeLine("DB", `Query ${label}`, {
          duration: `${Date.now() - t0}ms`,
          requestId: ctx.requestId,
        });
        return result;
      } catch (error) {
        writeLine("DB", `Query ${label} FAILED`, {
          duration: `${Date.now() - t0}ms`,
          requestId: ctx.requestId,
        });
        debugError(`DB_${operation}_FAILED`, error, { op: label });
        throw error;
      }
    },

    /** One scannable summary block for the operation. */
    summary(details: LogDetails = {}) {
      ctx.summarized = true;
      debugBlock(domain, operation, {
        requestId: ctx.requestId,
        ...details,
        duration: `${Date.now() - startedAt}ms`,
        result: details.result ?? "SUCCESS",
      });
    },

    success(meta?: Record<string, unknown>, responseBody?: unknown) {
      const duration = Date.now() - startedAt;
      if (!ctx.summarized) {
        const details: LogDetails = { requestId: ctx.requestId, duration: `${duration}ms` };
        if (meta) {
          for (const [k, v] of Object.entries(meta)) {
            if (v === undefined) continue;
            details[k] =
              typeof v === "string" ||
              typeof v === "number" ||
              typeof v === "boolean" ||
              v === null
                ? v
                : String(v);
          }
        }
        debugBlock(domain, "SUCCESS", details);
      }

      if (!responseLogged && responseBody !== undefined) {
        responseLogged = true;
        logApiResponse({
          status: 200,
          durationMs: duration,
          body: responseBody,
        });
      } else if (!responseLogged && source === "SERVER-ACTION") {
        // Compact success line for actions without a body dump.
        writeLine("API", "SUCCESS", {
          requestId: ctx.requestId,
          duration: `${duration}ms`,
        });
      }
    },

    fail(error: unknown, meta?: Record<string, unknown>) {
      const duration = Date.now() - startedAt;
      debugError(`${domain}_${operation}_FAILED`, error, {
        ...meta,
        attemptId: meta?.resourceId ? maskId(String(meta.resourceId)) : undefined,
        duration: `${duration}ms`,
      });
      writeLine("API", "FAILED", {
        requestId: ctx.requestId,
        duration: `${duration}ms`,
      });

      if (!responseLogged && error != null) {
        responseLogged = true;
        const message =
          error instanceof Error
            ? error.message
            : typeof error === "string"
              ? error
              : "Something went wrong.";
        logApiResponse({
          status: 400,
          durationMs: duration,
          body: { success: false, error: message },
        });
      }
    },

    logResponse(status: number, body?: unknown) {
      responseLogged = true;
      logApiResponse({
        status,
        durationMs: Date.now() - startedAt,
        body,
      });
    },

    durationMs() {
      return Date.now() - startedAt;
    },
  };
}
