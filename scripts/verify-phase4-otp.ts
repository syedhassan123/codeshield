/**
 * Phase 4 OTP verification (server-side rules).
 * Run: npx tsx --env-file=.env.local scripts/verify-phase4-otp.ts
 */
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { generateOtpCode, hashOtpCode, verifyOtpCode } from "../src/lib/otp/crypto";
import { issueEmailOtp, verifyEmailOtp } from "../src/lib/otp/service";
import { EmailOtp } from "../src/models/EmailOtp";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  await connectDB();
  const user = await User.findOne({ email: "demo@codeshield.ai" });
  assert(user, "demo user exists");

  await EmailOtp.deleteMany({ userId: user!._id });

  const code = generateOtpCode(6);
  assert(code.length === 6, "otp length 6");
  const hash = hashOtpCode(code, user!.email);
  assert(verifyOtpCode(code, user!.email, hash), "hash verify works");
  assert(!verifyOtpCode("000000", user!.email, hash), "wrong code fails hash");

  await issueEmailOtp(user!._id.toString());
  const active = await EmailOtp.findOne({
    userId: user!._id,
    consumedAt: null,
  }).sort({ createdAt: -1 });
  assert(active, "active otp created");
  assert(active!.expiresAt.getTime() > Date.now(), "otp not expired");

  // Invalid attempt
  let invalidBlocked = false;
  try {
    await verifyEmailOtp(user!._id.toString(), "000000");
  } catch {
    invalidBlocked = true;
  }
  assert(invalidBlocked, "invalid otp rejected");

  // Recover real code from hash by re-issuing in controlled way
  await EmailOtp.deleteMany({ userId: user!._id });
  const known = "123456";
  await EmailOtp.create({
    userId: user!._id,
    email: user!.email,
    codeHash: hashOtpCode(known, user!.email),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    maxAttempts: 5,
    lastSentAt: new Date(),
    consumedAt: null,
  });

  await verifyEmailOtp(user!._id.toString(), known);
  const refreshed = await User.findById(user!._id);
  assert(refreshed?.otpLoginVerifiedAt, "otpLoginVerifiedAt set after verify");

  // Expired
  await EmailOtp.deleteMany({ userId: user!._id });
  await EmailOtp.create({
    userId: user!._id,
    email: user!.email,
    codeHash: hashOtpCode("654321", user!.email),
    expiresAt: new Date(Date.now() - 1000),
    attempts: 0,
    maxAttempts: 5,
    lastSentAt: new Date(Date.now() - 120000),
    consumedAt: null,
  });
  let expiredBlocked = false;
  try {
    await verifyEmailOtp(user!._id.toString(), "654321");
  } catch (e) {
    expiredBlocked = e instanceof Error && e.message.toLowerCase().includes("expired");
  }
  assert(expiredBlocked, "expired otp rejected");

  // Retry limit
  await EmailOtp.deleteMany({ userId: user!._id });
  await EmailOtp.create({
    userId: user!._id,
    email: user!.email,
    codeHash: hashOtpCode("111222", user!.email),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    attempts: 0,
    maxAttempts: 5,
    lastSentAt: new Date(Date.now() - 120000),
    consumedAt: null,
  });
  for (let i = 0; i < 5; i++) {
    try {
      await verifyEmailOtp(user!._id.toString(), "000000");
    } catch {
      // expected
    }
  }
  let locked = false;
  try {
    await verifyEmailOtp(user!._id.toString(), "111222");
  } catch {
    locked = true;
  }
  assert(locked, "max attempts locks otp");

  // Resend cooldown returns reused active OTP (soft success)
  await EmailOtp.deleteMany({ userId: user!._id });
  await issueEmailOtp(user!._id.toString());
  const cooled = await issueEmailOtp(user!._id.toString());
  assert(
    "reused" in cooled && cooled.reused === true,
    "resend cooldown reuses active otp",
  );

  console.log("\nPhase 4 OTP verification passed.");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
