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
        // Never log password or raw credentials.
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
            faceVerified: skip,
          };
        } catch (error) {
          debugError("Login authorize failed", error);
          return null;
        }
      },
    }),
  ],
});

export { homeForRole } from "@/lib/auth.config";
