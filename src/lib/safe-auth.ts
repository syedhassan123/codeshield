import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";
import { debugLog, maskEmail, maskId } from "@/lib/debug";
import type { UserRole } from "@/types/user";

export async function requirePageRole(roles: UserRole[]) {
  debugLog("SERVER-COMPONENT", "requirePageRole", {
    required: roles.map((r) => r.toUpperCase()).join("|"),
  });

  const session = await auth();
  debugLog("SESSION", "retrieved", {
    role: (session?.user?.role || "anonymous").toUpperCase(),
    id: maskId(session?.user?.id),
    email: maskEmail(session?.user?.email),
  });

  if (!session?.user) {
    debugLog("AUTHORIZATION", "DENIED", { reason: "unauthenticated" });
    debugLog("HTTP", "403 Forbidden");
    redirect("/");
  }

  if (!roles.includes(session.user.role)) {
    debugLog("AUTHORIZATION", "DENIED", {
      role: session.user.role.toUpperCase(),
      required: roles.map((r) => r.toUpperCase()).join("|"),
    });
    debugLog("HTTP", "403 Forbidden");
    redirect(homeForRole(session.user.role));
  }

  debugLog("AUTHORIZATION", "ALLOWED", {
    role: session.user.role.toUpperCase(),
  });
  return session;
}
