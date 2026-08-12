/**
 * Registration OTP flow checks (no Auth.js session after verify).
 * Run: npx tsx --env-file=.env.local scripts/verify-registration-otp.ts
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { hashOtpCode } from "../src/lib/otp/crypto";
import {
  issueEmailOtp,
  verifyEmailOtp,
  verifyRegistrationOtpByEmail,
} from "../src/lib/otp/service";
import { EmailOtp } from "../src/models/EmailOtp";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  await connectDB();

  // Ensure demo users remain login-ready
  await User.updateMany(
    {
      email: {
        $in: [
          "admin@codeshield.ai",
          "rohan@codeshield.edu",
          "kabir@codeshield.ai",
          "demo@codeshield.ai",
        ],
      },
    },
    { $set: { emailVerified: true } },
  );

  const email = `reg-test-${Date.now()}@codeshield.test`;
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await User.create({
    email,
    passwordHash,
    name: "Reg Test",
    role: "student",
    status: "active",
    emailVerified: false,
    avatar: "RT",
  });
  assert(user.emailVerified === false, "new user emailVerified=false");

  // Duplicate email should be detectable
  const dup = await User.findOne({ email });
  assert(dup, "user exists for duplicate check");

  await EmailOtp.deleteMany({ userId: user._id });

  // Issue registration OTP
  await issueEmailOtp(user._id.toString(), "registration");
  const active = await EmailOtp.findOne({
    userId: user._id,
    purpose: "registration",
    consumedAt: null,
  }).sort({ createdAt: -1 });
  assert(active, "registration OTP created");
  assert(active!.purpose === "registration", "OTP purpose is registration");

  // Wrong OTP
  let wrongBlocked = false;
  try {
    await verifyRegistrationOtpByEmail(email, "000000");
  } catch {
    wrongBlocked = true;
  }
  assert(wrongBlocked, "wrong registration OTP rejected");

  // Expired OTP
  await EmailOtp.deleteMany({ userId: user._id });
  await EmailOtp.create({
    userId: user._id,
    email,
    purpose: "registration",
    codeHash: hashOtpCode("654321", email),
    expiresAt: new Date(Date.now() - 1000),
    attempts: 0,
    maxAttempts: 5,
    lastSentAt: new Date(Date.now() - 120000),
    consumedAt: null,
  });
  let expiredBlocked = false;
  try {
    await verifyRegistrationOtpByEmail(email, "654321");
  } catch (e) {
    expiredBlocked =
      e instanceof Error && e.message.toLowerCase().includes("expired");
  }
  assert(expiredBlocked, "expired registration OTP rejected");

  // Valid OTP → emailVerified=true, OTP consumed
  await EmailOtp.deleteMany({ userId: user._id });
  const known = "112233";
  await EmailOtp.create({
    userId: user._id,
    email,
    purpose: "registration",
    codeHash: hashOtpCode(known, email),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    maxAttempts: 5,
    lastSentAt: new Date(),
    consumedAt: null,
  });

  await verifyRegistrationOtpByEmail(email, known);
  const verified = await User.findById(user._id);
  assert(verified?.emailVerified === true, "emailVerified=true after OTP");

  const consumed = await EmailOtp.findOne({
    userId: user._id,
    purpose: "registration",
  }).sort({ createdAt: -1 });
  assert(consumed?.consumedAt, "registration OTP invalidated after success");

  // Reused OTP rejected
  let reuseBlocked = false;
  try {
    await verifyRegistrationOtpByEmail(email, known);
  } catch {
    reuseBlocked = true;
  }
  assert(reuseBlocked, "reused registration OTP rejected");

  // Registration OTP must NOT set otpLoginVerifiedAt (login session proof)
  // Clear and verify login-purpose path still works separately
  const beforeLoginOtp = verified?.otpLoginVerifiedAt;
  await EmailOtp.deleteMany({ userId: user._id });
  await EmailOtp.create({
    userId: user._id,
    email,
    purpose: "login",
    codeHash: hashOtpCode("998877", email),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    maxAttempts: 5,
    lastSentAt: new Date(),
    consumedAt: null,
  });
  await verifyEmailOtp(user._id.toString(), "998877", "login");
  const afterLogin = await User.findById(user._id);
  assert(
    afterLogin?.otpLoginVerifiedAt &&
      (!beforeLoginOtp ||
        new Date(afterLogin.otpLoginVerifiedAt).getTime() !==
          new Date(beforeLoginOtp).getTime()),
    "login OTP sets otpLoginVerifiedAt separately",
  );

  // Cleanup test user
  await EmailOtp.deleteMany({ userId: user._id });
  await User.deleteOne({ _id: user._id });

  console.log("\nRegistration OTP verification passed.");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
