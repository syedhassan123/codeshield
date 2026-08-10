import { handlers } from "@/lib/auth";
import { debugLog } from "@/lib/debug";

const { GET: authGET, POST: authPOST } = handlers;

export async function GET(
  ...args: Parameters<typeof authGET>
) {
  debugLog("API", "AUTH_GET", { path: "/api/auth/[...nextauth]" });
  return authGET(...args);
}

export async function POST(
  ...args: Parameters<typeof authPOST>
) {
  debugLog("API", "AUTH_POST", { path: "/api/auth/[...nextauth]" });
  return authPOST(...args);
}
