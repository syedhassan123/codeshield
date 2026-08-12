import { redirect } from "next/navigation";
import { auth, homeForRole } from "@/lib/auth";
import {
  beginRequestLog,
  logAuthorization,
  logSessionOnce,
} from "@/lib/debug";
import type { UserRole } from "@/types/user";

export async function requirePageRole(roles: UserRole[]) {
  beginRequestLog({
    label: `requirePageRole(${roles.join("|")})`,
    source: "SERVER-COMPONENT",
  });

  const session = await auth();
  logSessionOnce(session?.user);

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

  logAuthorization({
    allowed: true,
    action: "access_page",
    role: session.user.role,
    resource: `roles:${roles.join("|")}`,
  });

  return session;
}
