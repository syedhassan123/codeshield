import { handlers } from "@/lib/auth";
import {
  beginRequestLog,
  debugLog,
  logApiResponse,
} from "@/lib/debug";

const { GET: authGET, POST: authPOST } = handlers;

async function withAuthApiLog(
  method: "GET" | "POST",
  handler: typeof authGET,
  args: Parameters<typeof authGET>,
) {
  const startedAt = Date.now();
  beginRequestLog({
    label: `${method} /api/auth/[...nextauth]`,
    source: "API",
  });
  debugLog("API", `${method} /api/auth/[...nextauth]`);

  try {
    const response = await handler(...args);
    // Never dump NextAuth cookies/tokens — status only.
    logApiResponse({
      method,
      path: "/api/auth/[...nextauth]",
      status: response.status,
      durationMs: Date.now() - startedAt,
      body: {
        success: response.ok,
        note: "NextAuth response body omitted (may contain session tokens)",
      },
    });
    return response;
  } catch (error) {
    logApiResponse({
      method,
      path: "/api/auth/[...nextauth]",
      status: 500,
      durationMs: Date.now() - startedAt,
      body: {
        success: false,
        error: error instanceof Error ? error.message : "Auth handler failed",
      },
    });
    throw error;
  }
}

export async function GET(...args: Parameters<typeof authGET>) {
  return withAuthApiLog("GET", authGET, args);
}

export async function POST(...args: Parameters<typeof authPOST>) {
  return withAuthApiLog("POST", authPOST, args);
}
