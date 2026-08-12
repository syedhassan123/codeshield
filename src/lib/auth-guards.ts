import { auth } from "@/lib/auth";
import {
  beginRequestLog,
  logAuthOnce,
  logAuthorization,
} from "@/lib/debug";
import type { UserRole } from "@/types/user";

export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export async function requireSession() {
  beginRequestLog();
  const session = await auth();
  logAuthOnce(session?.user);

  if (!session?.user?.id) {
    logAuthorization({
      allowed: false,
      action: "require_session",
      reason: "UNAUTHENTICATED",
    });
    throw new ActionError("You must be signed in.");
  }

  // Role gate only — specific action ALLOWED is logged by createServerOp.allowed().
  return session;
}

export async function requireRole(roles: UserRole[]) {
  beginRequestLog();
  const session = await auth();
  logAuthOnce(session?.user);

  if (!session?.user?.id) {
    logAuthorization({
      allowed: false,
      action: "require_role",
      reason: "UNAUTHENTICATED",
      role: "ANONYMOUS",
    });
    throw new ActionError("You must be signed in.");
  }

  if (!roles.includes(session.user.role)) {
    logAuthorization({
      allowed: false,
      action: "require_role",
      role: session.user.role,
      reason: `${roles.map((r) => r.toUpperCase()).join("|")}_ONLY`,
    });
    throw new ActionError("You are not allowed to perform this action.");
  }

  return session;
}

export async function requireAdmin() {
  return requireRole(["admin"]);
}

export async function requireStudent() {
  return requireRole(["student"]);
}
