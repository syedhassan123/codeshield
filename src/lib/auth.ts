import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/lib/auth.config";
import { connectDB } from "@/lib/db";
import { debugError, debugLog, maskEmail, maskId } from "@/lib/debug";
import { User } from "@/models/User";
import type { UserRole } from "@/types/user";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  skipVerification: z.enum(["true", "false"]).optional(),
});

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
          if (skip) {
            await User.findByIdAndUpdate(user._id, {
              $set: { otpLoginVerifiedAt: new Date() },
            });
          }

          debugLog("AUTH", "LOGIN_SUCCESS", {
            role: user.role.toUpperCase(),
            id: maskId(user._id.toString()),
            email: maskEmail(user.email),
            skipVerification: skip,
            duration: `${Date.now() - startedAt}ms`,
          });

          return {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role as UserRole,
            avatar: user.avatar || undefined,
            otpVerified: skip,
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
        // Stable login timestamp — session.update must not refresh this.
        token.authTime = Date.now();
      }

      if (trigger === "update" && session) {
        // Client cannot forge otpVerified; only DB proof after verifyOtpAction.
        if (session.refreshOtpStatus === true && token.id) {
          await connectDB();
          const dbUser = await User.findById(token.id)
            .select("otpLoginVerifiedAt")
            .lean();
          const verifiedAt = dbUser?.otpLoginVerifiedAt
            ? new Date(dbUser.otpLoginVerifiedAt).getTime()
            : 0;
          const authTime =
            typeof token.authTime === "number"
              ? token.authTime
              : typeof token.iat === "number"
                ? token.iat * 1000
                : 0;

          if (verifiedAt > 0 && verifiedAt >= authTime - 5000) {
            token.otpVerified = true;
            debugLog("AUTH", "OTP_SESSION_SYNC", {
              id: maskId(String(token.id)),
            });
          } else {
            debugLog("AUTH", "OTP_SESSION_SYNC_DENIED", {
              id: maskId(String(token.id)),
              verifiedAt,
              authTime,
            });
          }
        }

        if (typeof session.faceVerified === "boolean") {
          token.faceVerified = session.faceVerified;
        }
      }

      return token;
    },
  },
});

export { homeForRole } from "@/lib/auth.config";
