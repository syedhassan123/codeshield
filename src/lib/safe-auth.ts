import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";
import { beginRequestLog, logAuthorization } from "@/lib/debug";
import type { UserRole } from "@/types/user";

/**
 * Page-level gate. Does not print AUTH on success — the server action's
 * createServerOp + requireAdmin/Student owns the readable request flow.
 */
export async function requirePageRole(roles: UserRole[]) {
  beginRequestLog();

  const session = await auth();

  if (!session?.user) {
    logAuthorization({
      allowed: false,
      action: "access_page",
      reason: "UNAUTHENTICATED",
      role: "ANONYMOUS",
    });
    redirect("/");
  }

  if (!roles.includes(session.user.role)) {
    logAuthorization({
      allowed: false,
      action: "access_page",
      role: session.user.role,
      reason: `${roles.map((r) => r.toUpperCase()).join("|")}_ONLY`,
    });
    redirect(homeForRole(session.user.role));
  }

  return session;
}
