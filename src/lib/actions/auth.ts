"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, homeForRole, signIn, signOut } from "@/lib/auth";
import { ActionError } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import {
  createServerOp,
  debugError,
  debugLog,
  maskEmail,
  maskId,
} from "@/lib/debug";
import { issueEmailOtp, verifyEmailOtp } from "@/lib/otp/service";
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

const otpCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

export type AuthActionState = {
  error?: string;
  success?: string;
};

function toAuthError(error: unknown) {
  if (error instanceof ActionError) return { error: error.message };
  if (error instanceof Error) return { error: error.message };
  return { error: "Something went wrong." };
}

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
    throw error;
  }

  op.success({ role: role.toUpperCase(), email: maskEmail(creds.email) });
}

/** Send / resend email OTP for the authenticated (pre-OTP) session. */
export async function sendOtpAction() {
  const op = createServerOp({
    domain: "AUTH",
    operation: "SEND_OTP",
    source: "SERVER-ACTION",
  });

  try {
    const session = await auth();
    op.auth(session?.user);
    if (!session?.user?.id) {
      op.denied("unauthenticated");
      return { error: "You must be signed in." };
    }
    if (session.user.otpVerified) {
      op.success({ alreadyVerified: true });
      return { success: true, alreadyVerified: true as const };
    }

    op.allowed("send otp");
    await connectDB();
    const result = await issueEmailOtp(session.user.id);
    op.success({
      delivered: result.delivered,
      mode: result.mode,
      reused: "reused" in result ? result.reused : false,
    });

    let message =
      "Verification code generated. Check server logs if SMTP is not configured (dev).";
    if ("reused" in result && result.reused) {
      message = "A code was already sent. Please wait before requesting another.";
    } else if (result.delivered) {
      message = "Verification code sent to your email.";
    }

    return {
      success: true as const,
      expiresAt: result.expiresAt,
      resendAvailableAt: result.resendAvailableAt,
      delivered: result.delivered,
      message,
    };
  } catch (error) {
    op.fail(error);
    return toAuthError(error);
  }
}

/** Verify OTP server-side and mark session eligible for otpVerified sync. */
export async function verifyOtpAction(raw: unknown) {
  const op = createServerOp({
    domain: "AUTH",
    operation: "VERIFY_OTP",
    source: "SERVER-ACTION",
  });

  try {
    const session = await auth();
    op.auth(session?.user);
    if (!session?.user?.id) {
      op.denied("unauthenticated");
      return { error: "You must be signed in." };
    }

    const parsed = otpCodeSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid code." };
    }

    op.allowed("verify otp");
    await connectDB();
    await verifyEmailOtp(session.user.id, parsed.data.code);

    op.success({
      id: maskId(session.user.id),
      redirectTo: homeForRole(session.user.role),
    });
    return {
      success: true as const,
      redirectTo: homeForRole(session.user.role),
    };
  } catch (error) {
    op.fail(error);
    return toAuthError(error);
  }
}

/** @deprecated Use verifyOtpAction — kept as alias during transition. */
export async function completeOtpAction() {
  return { error: "Enter the verification code from your email." };
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

  if (!session.user.otpVerified) {
    op.denied("otp_required");
    return { error: "Complete email OTP verification first." };
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
