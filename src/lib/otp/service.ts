import { ActionError } from "@/lib/auth-guards";
import { debugLog, isVerboseDebugEnabled, maskEmail, maskId } from "@/lib/debug";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "@/lib/otp/crypto";
import { sendOtpEmail } from "@/lib/otp/email";
import { EmailOtp, type OtpPurpose } from "@/models/EmailOtp";
import { User } from "@/models/User";

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_SENDS_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

function authFlowLog(tag: string, message: string) {
  if (!isVerboseDebugEnabled()) return;
  console.log(`[${tag}] ${message}`);
}

export async function issueEmailOtp(
  userId: string,
  purpose: OtpPurpose = "login",
) {
  const user = await User.findById(userId);
  if (!user) throw new ActionError("User not found.");
  if (user.status === "suspended") {
    throw new ActionError("This account is suspended.");
  }

  const email = user.email.toLowerCase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSends = await EmailOtp.countDocuments({
    email,
    purpose,
    createdAt: { $gte: oneHourAgo },
  });
  if (recentSends >= MAX_SENDS_PER_HOUR) {
    throw new ActionError(
      "Too many OTP requests. Please wait and try again later.",
    );
  }

  const latest = await EmailOtp.findOne({
    email,
    purpose,
    consumedAt: null,
  }).sort({
    createdAt: -1,
  });
  if (
    latest?.lastSentAt &&
    Date.now() - latest.lastSentAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    const waitMs =
      RESEND_COOLDOWN_MS - (Date.now() - latest.lastSentAt.getTime());
    const waitSec = Math.ceil(waitMs / 1000);
    // Active OTP already exists — treat as soft success (helps React Strict Mode double-mount).
    debugLog("AUTH", "OTP_RESEND_COOLDOWN", {
      email: maskEmail(email),
      purpose,
      waitSec,
    });
    return {
      expiresAt: latest.expiresAt.toISOString(),
      resendAvailableAt: new Date(Date.now() + waitMs).toISOString(),
      delivered: false,
      mode: "cooldown" as const,
      reused: true as const,
    };
  }

  // Invalidate previous active codes for this purpose only
  await EmailOtp.updateMany(
    { email, purpose, consumedAt: null },
    { $set: { consumedAt: new Date() } },
  );

  const code = generateOtpCode(6);
  const now = new Date();
  const doc = await EmailOtp.create({
    userId: user._id,
    email,
    purpose,
    codeHash: hashOtpCode(code, email),
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    attempts: 0,
    maxAttempts: MAX_ATTEMPTS,
    lastSentAt: now,
    consumedAt: null,
  });

  if (purpose === "registration") {
    authFlowLog("OTP", "Registration OTP generated");
  }

  debugLog("AUTH", "OTP_ISSUED", {
    userId: maskId(userId),
    email: maskEmail(email),
    purpose,
    otpId: maskId(doc._id.toString()),
  });

  const sendResult = await sendOtpEmail({
    to: email,
    code,
    name: user.name,
  });

  if (purpose === "registration") {
    authFlowLog("OTP", "Registration OTP sent");
  }

  return {
    expiresAt: doc.expiresAt.toISOString(),
    resendAvailableAt: new Date(
      now.getTime() + RESEND_COOLDOWN_MS,
    ).toISOString(),
    delivered: sendResult.delivered,
    mode: sendResult.mode,
  };
}

export async function issueRegistrationOtpByEmail(emailRaw: string) {
  const email = emailRaw.toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) throw new ActionError("No account found for this email.");
  if (user.status === "suspended") {
    throw new ActionError("This account is suspended.");
  }
  if (user.emailVerified === true) {
    throw new ActionError("Email already verified. Please log in.");
  }
  return issueEmailOtp(user._id.toString(), "registration");
}

export async function verifyEmailOtp(
  userId: string,
  code: string,
  purpose: OtpPurpose = "login",
) {
  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length !== 6) {
    throw new ActionError("Enter the 6-digit code.");
  }

  const user = await User.findById(userId);
  if (!user) throw new ActionError("User not found.");

  const email = user.email.toLowerCase();
  const challenge = await EmailOtp.findOne({
    userId: user._id,
    email,
    purpose,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (!challenge) {
    throw new ActionError("No active OTP. Please request a new code.");
  }

  if (challenge.expiresAt.getTime() < Date.now()) {
    challenge.consumedAt = new Date();
    await challenge.save();
    throw new ActionError("This code has expired. Request a new one.");
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    challenge.consumedAt = new Date();
    await challenge.save();
    throw new ActionError("Too many invalid attempts. Request a new code.");
  }

  const ok = verifyOtpCode(cleaned, email, challenge.codeHash);
  if (!ok) {
    challenge.attempts += 1;
    if (challenge.attempts >= challenge.maxAttempts) {
      challenge.consumedAt = new Date();
    }
    await challenge.save();
    const left = Math.max(0, challenge.maxAttempts - challenge.attempts);
    throw new ActionError(
      left > 0
        ? `Invalid code. ${left} attempt${left === 1 ? "" : "s"} left.`
        : "Too many invalid attempts. Request a new code.",
    );
  }

  // Invalidate — never reusable after success
  challenge.consumedAt = new Date();
  await challenge.save();

  const verifiedAt = new Date();

  if (purpose === "registration") {
    await User.findByIdAndUpdate(user._id, {
      $set: { emailVerified: true },
    });
    authFlowLog("REGISTER", "Email verified");
  } else {
    // Marks OTP success for this login session (JWT sync checks this vs token.authTime).
    await User.findByIdAndUpdate(user._id, {
      $set: { otpLoginVerifiedAt: verifiedAt },
    });
  }

  debugLog("AUTH", "OTP_VERIFIED", {
    userId: maskId(userId),
    email: maskEmail(email),
    purpose,
  });

  return { success: true as const, verifiedAt: verifiedAt.toISOString() };
}

export async function verifyRegistrationOtpByEmail(
  emailRaw: string,
  code: string,
) {
  const email = emailRaw.toLowerCase().trim();
  const user = await User.findOne({ email });
  if (!user) throw new ActionError("No account found for this email.");
  if (user.emailVerified === true) {
    throw new ActionError("Email already verified. Please log in.");
  }
  return verifyEmailOtp(user._id.toString(), code, "registration");
}

export { authFlowLog };
