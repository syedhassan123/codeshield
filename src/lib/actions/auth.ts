"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, homeForRole, signIn, signOut } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  createServerOp,
  debugError,
  debugLog,
  maskEmail,
  maskId,
} from "@/lib/debug";
import { User } from "@/models/User";
import { USER_ROLES, type UserRole } from "@/types/user";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(USER_ROLES).default("student"),
});

export type AuthActionState = {
  error?: string;
  success?: string;
};

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const op = createServerOp({
    domain: "AUTH",
    operation: "LOGIN_ACTION",
    source: "SERVER-ACTION",
  });

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    op.fail("invalid login form");
    return { error: "Enter a valid email and password." };
  }

  debugLog("AUTH", "login_action_start", {
    email: maskEmail(parsed.data.email),
  });

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      skipVerification: "false",
      redirectTo: "/verify-otp",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      op.fail(error, { reason: "auth_error" });
      return { error: "Invalid email or password." };
    }
    // Next.js redirect throws; rethrow without treating as failure noise.
    throw error;
  }

  op.success({ email: maskEmail(parsed.data.email) });
  return {};
}

export async function registerAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const op = createServerOp({
    domain: "AUTH",
    operation: "REGISTER_ACTION",
    source: "SERVER-ACTION",
  });

  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || String(formData.get("email")).split("@")[0],
    role: formData.get("role") || "student",
  });

  if (!parsed.success) {
    op.fail("invalid register form");
    return { error: "Check your details and try again." };
  }

  debugLog("AUTH", "register_action_start", {
    email: maskEmail(parsed.data.email),
    role: parsed.data.role.toUpperCase(),
  });

  try {
    await connectDB();
    const existing = await op.runMongo("check existing user", () =>
      User.findOne({
        email: parsed.data.email.toLowerCase(),
      }),
    );
    if (existing) {
      op.fail("email already exists");
      return { error: "An account with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(parsed.data.password, 12);
    await op.runMongo("create user", () =>
      User.create({
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        name: parsed.data.name,
        role: parsed.data.role,
        status: "active",
        avatar: parsed.data.name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      }),
    );

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      skipVerification: "false",
      redirectTo: "/verify-otp",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      op.fail(error, { reason: "sign_in_after_register_failed" });
      return { error: "Account created but sign-in failed. Try logging in." };
    }
    throw error;
  }

  op.success({ email: maskEmail(parsed.data.email) });
  return {};
}

export async function demoLoginAction(role: UserRole) {
  const op = createServerOp({
    domain: "AUTH",
    operation: "DEMO_LOGIN",
    source: "SERVER-ACTION",
  });
  debugLog("AUTH", "demo_login", { role: role.toUpperCase() });

  const demos: Record<UserRole, { email: string; password: string }> = {
    admin: { email: "admin@codeshield.ai", password: "password123" },
    student: { email: "rohan@codeshield.edu", password: "password123" },
    interviewer: { email: "kabir@codeshield.ai", password: "password123" },
  };

  const creds = demos[role];
  try {
    await signIn("credentials", {
      email: creds.email,
      password: creds.password,
      skipVerification: "true",
      redirectTo: homeForRole(role),
    });
  } catch (error) {
    // redirect throw expected
    throw error;
  }

  op.success({ role: role.toUpperCase(), email: maskEmail(creds.email) });
}

export async function completeOtpAction() {
  const op = createServerOp({
    domain: "AUTH",
    operation: "COMPLETE_OTP",
    source: "SERVER-ACTION",
  });
  const session = await auth();
  op.auth(session?.user);

  if (!session?.user) {
    op.denied("unauthenticated");
    return { error: "Not authenticated" };
  }

  op.allowed();
  op.success({ id: maskId(session.user.id) });
  // Phase 0: accept any completed OTP UI submission (mock OTP).
  return { success: true };
}

export async function completeFaceAction() {
  const op = createServerOp({
    domain: "AUTH",
    operation: "COMPLETE_FACE",
    source: "SERVER-ACTION",
  });
  const session = await auth();
  op.auth(session?.user);

  if (!session?.user) {
    op.denied("unauthenticated");
    return { error: "Not authenticated" };
  }

  op.allowed();
  try {
    await connectDB();
    await op.runMongo("set faceVerifiedAt", () =>
      User.findByIdAndUpdate(session.user.id, {
        faceVerifiedAt: new Date(),
      }),
    );
    op.success({ id: maskId(session.user.id) });
    return { success: true, redirectTo: homeForRole(session.user.role) };
  } catch (error) {
    op.fail(error);
    debugError("completeFaceAction failed", error);
    return { error: "Face verification update failed." };
  }
}

export async function logoutAction() {
  const op = createServerOp({
    domain: "AUTH",
    operation: "LOGOUT",
    source: "SERVER-ACTION",
  });
  const session = await auth();
  op.auth(session?.user);
  debugLog("AUTH", "logout_start");
  await signOut({ redirectTo: "/" });
  op.success();
}
