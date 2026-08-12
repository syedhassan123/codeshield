import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@/types/user";

export function homeForRole(role: UserRole) {
  switch (role) {
    case "admin":
      return "/admin";
    case "interviewer":
      return "/interviewer";
    default:
      return "/student";
  }
}

/** Edge-safe auth config (used by middleware). No MongoDB imports here. */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/",
  },
  providers: [],
  callbacks: {
    authorized() {
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.avatar = user.avatar;
        token.otpVerified = Boolean(user.otpVerified);
        token.faceVerified = Boolean(user.faceVerified);
      }

      if (trigger === "update" && session) {
        // Never trust client-provided otpVerified in the edge-safe config.
        // Node auth.ts overrides this callback to sync OTP from MongoDB.
        if (typeof session.faceVerified === "boolean") {
          token.faceVerified = session.faceVerified;
        }
      }

      return token;
    },
    async session({ session, token }) {
      session.user.id = String(token.id ?? "");
      session.user.role = token.role as UserRole;
      session.user.avatar = token.avatar as string | undefined;
      session.user.otpVerified = Boolean(token.otpVerified);
      session.user.faceVerified = Boolean(token.faceVerified);
      return session;
    },
  },
} satisfies NextAuthConfig;
