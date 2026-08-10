import { auth } from "@/lib/auth";
import { debugLog, maskEmail, maskId } from "@/lib/debug";
import type { UserRole } from "@/types/user";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

function logAuthUser(user?: {
  id?: string;
  email?: string | null;
  role?: string;
} | null) {
  debugLog("AUTH", "identity", {
    role: (user?.role || "anonymous").toUpperCase(),
    id: maskId(user?.id),
    email: maskEmail(user?.email),
  });
}

export async function requireSession() {
  const session = await auth();
  logAuthUser(session?.user);

  if (!session?.user?.id) {
    debugLog("AUTHORIZATION", "DENIED", { reason: "unauthenticated" });
    debugLog("HTTP", "403 Forbidden");
    throw new ActionError("You must be signed in.");
  }

  debugLog("AUTHORIZATION", "ALLOWED", { reason: "authenticated" });
  return session;
}

export async function requireRole(roles: UserRole[]) {
  const session = await auth();
  logAuthUser(session?.user);

  if (!session?.user?.id) {
    debugLog("AUTHORIZATION", "DENIED", { reason: "unauthenticated" });
    debugLog("HTTP", "403 Forbidden");
    throw new ActionError("You must be signed in.");
  }

  if (!roles.includes(session.user.role)) {
    debugLog("AUTHORIZATION", "DENIED", {
      role: session.user.role.toUpperCase(),
      required: roles.map((r) => r.toUpperCase()).join("|"),
    });
    debugLog("HTTP", "403 Forbidden");
    throw new ActionError("You are not allowed to perform this action.");
  }

  debugLog("AUTHORIZATION", "ALLOWED", {
    role: session.user.role.toUpperCase(),
  });
  return session;
}

export async function requireAdmin() {
  return requireRole(["admin"]);
}
