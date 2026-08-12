import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig, homeForRole } from "@/lib/auth.config";
import { connectDB } from "@/lib/db";
import {
  debugError,
  debugLog,
  isVerboseDebugEnabled,
  maskEmail,
  maskId,
} from "@/lib/debug";
import { User } from "@/models/User";
import type { UserRole } from "@/types/user";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  skipVerification: z.enum(["true", "false"]).optional(),
});

function flowLog(tag: string, message: string) {
  if (!isVerboseDebugEnabled()) return;
  console.log(`[${tag}] ${message}`);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        skipVerification: { label: "Skip Verification", type: "text" },
      },
      async authorize(credentials) {
        const startedAt = Date.now();
        flowLog("LOGIN", "Credentials authentication started");
        debugLog("AUTH", "LOGIN_ATTEMPT");
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          debugLog("AUTH", "LOGIN_DENIED", { reason: "invalid_payload" });
          return null;
        }

        debugLog("AUTH", "login_email", {
          email: maskEmail(parsed.data.email),
          skipVerification: parsed.data.skipVerification === "true",
        });

        try {
          await connectDB();
          const user = await User.findOne({
            email: parsed.data.email.toLowerCase(),
          });

          if (!user || user.status === "suspended") {
            debugLog("AUTH", "LOGIN_DENIED", {
              reason: !user ? "user_not_found" : "suspended",
              email: maskEmail(parsed.data.email),
            });
            return null;
          }

          const valid = await bcrypt.compare(
            parsed.data.password,
            user.passwordHash,
          );
          if (!valid) {
            debugLog("AUTH", "LOGIN_DENIED", {
              reason: "bad_password",
              id: maskId(user._id.toString()),
              email: maskEmail(user.email),
            });
            return null;
          }

          const skip = parsed.data.skipVerification === "true";

          // Explicit false blocks login; missing/true allows (legacy + verified).
          // Demo quick-login may skip registration verification.
          if (!skip && user.emailVerified === false) {
            debugLog("AUTH", "LOGIN_DENIED", {
              reason: "email_not_verified",
              id: maskId(user._id.toString()),
              email: maskEmail(user.email),
            });
            return null;
          }

          if (skip) {
            await User.findByIdAndUpdate(user._id, {
              $set: { emailVerified: true },
            });
          }

          const role = user.role as UserRole;
          const redirectTo = homeForRole(role);

          flowLog("LOGIN", "Credentials authentication SUCCESS");
          flowLog("AUTH", "Session created");
          flowLog("AUTH", `Role=${role.toUpperCase()}`);
          flowLog("AUTH", `Redirect=${redirectTo}`);
          debugLog("AUTH", "LOGIN_SUCCESS", {
            role: role.toUpperCase(),
            id: maskId(user._id.toString()),
            email: maskEmail(user.email),
            skipVerification: skip,
            duration: `${Date.now() - startedAt}ms`,
          });

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role,
            avatar: user.avatar || undefined,
            // Login no longer requires OTP — session is fully usable immediately.
            otpVerified: true,
            faceVerified: false,
          };
        } catch (error) {
          debugError("Login authorize failed", error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.avatar = user.avatar;
        token.otpVerified = Boolean(user.otpVerified);
        token.faceVerified = Boolean(user.faceVerified);
        token.authTime = Date.now();
      }

      if (trigger === "update" && session) {
        // Face remains optional / future — allow session.update for face only.
        if (typeof session.faceVerified === "boolean") {
          token.faceVerified = session.faceVerified;
        }
      }

      return token;
    },
  },
});

export { homeForRole } from "@/lib/auth.config";
