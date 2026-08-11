/**
 * Development-only verbose logger.
 * Enabled when NODE_ENV === "development" OR DEBUG_LOGS === "true".
 * Forced off when DEBUG_LOGS === "false".
 * Never log passwords, secrets, Mongo URIs, or raw credentials.
 */

export type LogPrefix =
  | "AUTH"
  | "AUTHORIZATION"
  | "ASSESSMENT"
  | "QUESTION"
  | "EXAM"
  | "ANSWER"
  | "RESULT"
  | "MONGODB"
  | "SERVER-ACTION"
  | "SERVER-COMPONENT"
  | "API"
  | "HTTP"
  | "ERROR"
  | "SESSION";

export function isVerboseDebugEnabled() {
  if (process.env.DEBUG_LOGS === "false") return false;
  if (process.env.DEBUG_LOGS === "true") return true;
  return process.env.NODE_ENV === "development";
}

export function maskEmail(email?: string | null) {
  if (!email) return "unknown";
  const [user, domain] = email.split("@");
  if (!domain) return "***";
  const visible = user.slice(0, 1);
  return `${visible}***@${domain}`;
}

export function maskId(id?: string | null) {
  if (!id) return "unknown";
  if (id.length <= 8) return `${id.slice(0, 2)}***`;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function formatMeta(meta?: Record<string, unknown>) {
  if (!meta || !Object.keys(meta).length) return "";
  return (
    " " +
    Object.entries(meta)
      .map(([k, v]) => `${k}=${String(v)}`)
      .join(" ")
  );
}

export function debugLog(
  prefix: LogPrefix,
  message: string,
  meta?: Record<string, unknown>,
) {
  if (!isVerboseDebugEnabled()) return;
  console.log(`[${prefix}] ${message}${formatMeta(meta)}`);
}

export function debugError(
  message: string,
  error?: unknown,
  meta?: Record<string, unknown>,
) {
  if (!isVerboseDebugEnabled()) return;
  console.error(`[ERROR] ${message}${formatMeta(meta)}`);
  if (error instanceof Error) {
    console.error(`[ERROR] ${error.message}`);
    if (error.stack) console.error(error.stack);
  } else if (error != null) {
    console.error(error);
  }
}

type AuthUserLike = {
  id?: string;
  email?: string | null;
  role?: string;
};

export function createServerOp(options: {
  domain: Extract<
    LogPrefix,
    "ASSESSMENT" | "QUESTION" | "AUTH" | "SESSION" | "EXAM" | "ANSWER" | "RESULT"
  >;
  operation: string;
  source?: "SERVER-ACTION" | "SERVER-COMPONENT" | "API";
  resourceId?: string;
}) {
  const startedAt = Date.now();
  const { domain, operation, source, resourceId } = options;

  if (source === "SERVER-ACTION") {
    debugLog("SERVER-ACTION", `${domain}.${operation}`, {
      resourceId: resourceId ? maskId(resourceId) : undefined,
    });
  } else if (source === "SERVER-COMPONENT") {
    debugLog("SERVER-COMPONENT", `${domain}.${operation}`, {
      resourceId: resourceId ? maskId(resourceId) : undefined,
    });
  } else if (source === "API") {
    debugLog("API", `${domain}.${operation}`, {
      resourceId: resourceId ? maskId(resourceId) : undefined,
    });
  }

  debugLog(domain, operation, {
    resourceId: resourceId ? maskId(resourceId) : undefined,
  });

  return {
    auth(user?: AuthUserLike | null) {
      debugLog("AUTH", "session", {
        role: (user?.role || "anonymous").toUpperCase(),
        id: maskId(user?.id),
        email: maskEmail(user?.email),
      });
    },

    allowed(detail?: string) {
      debugLog("AUTHORIZATION", "ALLOWED", detail ? { detail } : undefined);
    },

    denied(detail?: string) {
      debugLog("AUTHORIZATION", "DENIED", detail ? { detail } : undefined);
      debugLog("HTTP", "403 Forbidden");
    },

    mongo(message: string, meta?: Record<string, unknown>) {
      debugLog("MONGODB", message, meta);
    },

    async runMongo<T>(label: string, fn: () => Promise<T>): Promise<T> {
      const t0 = Date.now();
      debugLog("MONGODB", `${label}...`);
      try {
        const result = await fn();
        debugLog("MONGODB", "success", {
          op: label,
          duration: `${Date.now() - t0}ms`,
        });
        return result;
      } catch (error) {
        debugLog("MONGODB", "failure", {
          op: label,
          duration: `${Date.now() - t0}ms`,
        });
        debugError(`MongoDB ${label} failed`, error);
        throw error;
      }
    },

    success(meta?: Record<string, unknown>) {
      debugLog(domain, "SUCCESS", {
        ...meta,
        duration: `${Date.now() - startedAt}ms`,
      });
    },

    fail(error: unknown, meta?: Record<string, unknown>) {
      debugLog(domain, "FAILURE", {
        ...meta,
        duration: `${Date.now() - startedAt}ms`,
      });
      debugError(`${domain} ${operation} failed`, error, meta);
    },

    durationMs() {
      return Date.now() - startedAt;
    },
  };
}
