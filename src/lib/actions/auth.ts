"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth, homeForRole, signIn, signOut } from "@/lib/auth";
import { ActionError } from "@/lib/auth-guards";
import { connectDB } from "@/lib/db";
import {
  createServerOp,
  debugError,
  debugLog,
  isVerboseDebugEnabled,
  maskEmail,
  maskId,
} from "@/lib/debug";
import {
  authFlowLog,
  issueEmailOtp,
  issueRegistrationOtpByEmail,
  verifyRegistrationOtpByEmail,
} from "@/lib/otp/service";
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

const registrationOtpSchema = z.object({
  email: z.string().email(),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code."),
});

const registrationEmailSchema = z.object({
  email: z.string().email(),
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

function flowLog(tag: string, message: string) {
  if (!isVerboseDebugEnabled()) return;
  console.log(`[${tag}] ${message}`);
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

  flowLog("LOGIN", "Credentials authentication started");
  debugLog("AUTH", "login_action_start", {
    email: maskEmail(parsed.data.email),
  });

  try {
    await connectDB();
    const user = await User.findOne({
      email: parsed.data.email.toLowerCase(),
    });

    if (user) {
      const valid = await bcrypt.compare(
        parsed.data.password,
        user.passwordHash,
      );
      if (valid && user.emailVerified === false) {
        op.fail("email_not_verified");
        await issueEmailOtp(user._id.toString(), "registration");
        redirect(
          `/verify-otp?purpose=registration&email=${encodeURIComponent(user.email)}`,
        );
      }
    }

    const role = (user?.role as UserRole | undefined) || "student";
    const redirectTo = homeForRole(role);

    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      skipVerification: "false",
      redirectTo,
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

  flowLog("REGISTER", "Account creation started");
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
    const created = await op.runMongo("create user", () =>
      User.create({
        email: parsed.data.email.toLowerCase(),
        passwordHash,
        name: parsed.data.name,
        role: parsed.data.role,
        status: "active",
        emailVerified: false,
        avatar: parsed.data.name
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase(),
      }),
    );

    flowLog("REGISTER", "Account created");

    await issueEmailOtp(created._id.toString(), "registration");

    flowLog("AUTH", "Registration session NOT created");
    flowLog("AUTH", "Redirecting to OTP verification");
    op.success({ email: maskEmail(parsed.data.email) });

    redirect(
      `/verify-otp?purpose=registration&email=${encodeURIComponent(parsed.data.email.toLowerCase())}&registered=1`,
    );
  } catch (error) {
    if (error instanceof AuthError) {
      op.fail(error, { reason: "register_failed" });
      return { error: "Registration failed. Please try again." };
    }
    throw error;
  }
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

/** Login OTP is disabled — registration OTP only. */
export async function sendOtpAction() {
  return {
    error: "Login OTP is not required. Sign in with your email and password.",
  };
}

/** Send / resend registration OTP (no Auth.js session). */
export async function sendRegistrationOtpAction(raw: unknown) {
  const op = createServerOp({
    domain: "AUTH",
    operation: "SEND_REGISTRATION_OTP",
    source: "SERVER-ACTION",
  });

  try {
    const parsed = registrationEmailSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: "Enter a valid email address." };
    }

    await connectDB();
    const result = await issueRegistrationOtpByEmail(parsed.data.email);
    op.success({
      delivered: result.delivered,
      mode: result.mode,
      reused: "reused" in result ? result.reused : false,
    });

    let message = "We've sent a verification code to your email.";
    if ("reused" in result && result.reused) {
      message = "A code was already sent. Please wait before requesting another.";
    } else if (result.delivered) {
      message = "We've sent a verification code to your email.";
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

/** Login OTP is disabled — registration OTP only. */
export async function verifyOtpAction(_raw: unknown) {
  return {
    // const op = createServerOp({
    //   domain: "AUTH",
    //   operation: "SEND_OTP",
    //   source: "SERVER-ACTION",
    // });
  
    // try {
    //   const session = await auth();
    //   op.auth(session?.user);
    //   if (!session?.user?.id) {
    //     op.denied("unauthenticated");
    //     return { error: "You must be signed in." };
    //   }
    //   if (session.user.otpVerified) {
    //     op.success({ alreadyVerified: true });
    //     return { success: true, alreadyVerified: true as const };
    //   }
  
    //   op.allowed("send otp");
    //   await connectDB();
    //   const result = await issueEmailOtp(session.user.id, "login");
    //   op.success({
    //     delivered: result.delivered,
    //     mode: result.mode,
    //     reused: "reused" in result ? result.reused : false,
    //   });
  
    //   let message =
    //     "Verification code generated. Check server logs if SMTP is not configured (dev).";
    //   if ("reused" in result && result.reused) {
    //     message = "A code was already sent. Please wait before requesting another.";
    //   } else if (result.delivered) {
    //     message = "Verification code sent to your email.";
    //   }
  
    //   return {
    //     success: true as const,
    //     expiresAt: result.expiresAt,
    //     resendAvailableAt: result.resendAvailableAt,
    //     delivered: result.delivered,
    //     message,
    //   };
    // } catch (error) {
    //   op.fail(error);
    //   return toAuthError(error);
    // }
    error: "Login OTP is not required. Sign in with your email and password.",
  };
}

/**
 * Verify registration OTP — sets emailVerified=true.
 * Does NOT create an Auth.js session. Redirects to login.
 */
export async function verifyRegistrationOtpAction(raw: unknown) {
  const op = createServerOp({
    domain: "AUTH",
    operation: "VERIFY_REGISTRATION_OTP",
    source: "SERVER-ACTION",
  });

  try {
    const parsed = registrationOtpSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        error:
          parsed.error.issues[0]?.message ||
          "Enter a valid email and 6-digit code.",
      };
    }

    authFlowLog("OTP", "Registration verification started");
    await connectDB();
    await verifyRegistrationOtpByEmail(parsed.data.email, parsed.data.code);

    authFlowLog("OTP", "Registration verification SUCCESS");
    flowLog("AUTH", "Registration session NOT created");
    flowLog("AUTH", "Redirecting to login");

    op.success({
      email: maskEmail(parsed.data.email),
      redirectTo: "/?verified=1",
    });

    return {
      success: true as const,
      message: "Email verified successfully. Please log in to continue.",
      redirectTo: "/?verified=1",
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

  // Face is optional (exam/proctoring). It must not gate normal login.
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
