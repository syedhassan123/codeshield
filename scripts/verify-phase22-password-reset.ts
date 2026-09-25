/**
 * Phase 22 checks: /forgot-password issues a password_reset OTP and only
 * changes the hash after the code + new password are verified together.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-phase22-password-reset.ts
 */
import bcrypt from "bcryptjs";
import fs from "node:fs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { hashOtpCode } from "../src/lib/otp/crypto";
import {
  issuePasswordResetOtpByEmail,
  PASSWORD_RESET_REQUEST_MESSAGE,
  resetPasswordWithOtp,
} from "../src/lib/otp/service";
import { EmailOtp } from "../src/models/EmailOtp";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

function read(rel: string) {
  return fs.readFileSync(rel, "utf8");
}

function staticChecks() {
  const model = read("src/models/EmailOtp.ts");
  assert(
    model.includes('"password_reset"'),
    "EmailOtp purpose enum includes password_reset",
  );

  const page = read("src/app/forgot-password/page.tsx");
  assert(
    page.includes("ForgotPasswordClient"),
    "forgot-password page renders the real client, not a dead form",
  );

  const client = read("src/components/auth/forgot-password-client.tsx");
  assert(
    client.includes("requestPasswordResetAction") &&
      client.includes("confirmPasswordResetAction"),
    "client calls both request and confirm actions",
  );

  const actions = read("src/lib/actions/auth.ts");
  assert(
    actions.includes("requestPasswordResetAction") &&
      actions.includes("confirmPasswordResetAction"),
    "auth actions export the password-reset pair",
  );
  assert(
    !/requestPasswordResetAction[\s\S]*code:/.test(
      actions.slice(actions.indexOf("requestPasswordResetAction")),
    ) ||
      !actions
        .slice(
          actions.indexOf("requestPasswordResetAction"),
          actions.indexOf("confirmPasswordResetAction"),
        )
        .includes("code:"),
    "request action never returns the OTP code to the client",
  );

  const service = read("src/lib/otp/service.ts");
  assert(
    service.includes("purpose === \"login\""),
    "password_reset verification does not set otpLoginVerifiedAt (login-only branch)",
  );
}

async function dbChecks() {
  await connectDB();

  const email = `reset-test-${Date.now()}@codeshield.test`;
  const originalHash = await bcrypt.hash("oldpass123", 12);
  const user = await User.create({
    email,
    passwordHash: originalHash,
    name: "Reset Test",
    role: "student",
    status: "active",
    emailVerified: true,
    avatar: "RT",
  });

  const unknownEmail = `nobody-${Date.now()}@codeshield.test`;
  const suspendedEmail = `suspended-${Date.now()}@codeshield.test`;
  const suspended = await User.create({
    email: suspendedEmail,
    passwordHash: originalHash,
    name: "Suspended Reset",
    role: "student",
    status: "suspended",
    emailVerified: true,
    avatar: "SR",
  });

  try {
    const unknown = await issuePasswordResetOtpByEmail(unknownEmail);
    assert(unknown.issued === false, "unknown email does not issue a code");
    assert(
      (await EmailOtp.countDocuments({ email: unknownEmail })) === 0,
      "unknown email never creates an EmailOtp row",
    );

    const skipped = await issuePasswordResetOtpByEmail(suspendedEmail);
    assert(skipped.issued === false, "suspended account does not issue a code");
    assert(
      (await EmailOtp.countDocuments({ email: suspendedEmail })) === 0,
      "suspended account never creates an EmailOtp row",
    );

    const issued = await issuePasswordResetOtpByEmail(email);
    assert(issued.issued === true, "active account issues a password_reset OTP");
    const active = await EmailOtp.findOne({
      email,
      purpose: "password_reset",
      consumedAt: null,
    });
    assert(!!active, "an unconsumed password_reset OTP exists after issue");

    const beforeWrong = await User.findById(user._id);
    let wrongFailed = false;
    try {
      await resetPasswordWithOtp(email, "000000", "newpass123");
    } catch {
      wrongFailed = true;
    }
    assert(wrongFailed, "a wrong code does not reset the password");
    const afterWrong = await User.findById(user._id);
    assert(
      afterWrong!.passwordHash === beforeWrong!.passwordHash,
      "password hash is unchanged after a failed code",
    );

    await EmailOtp.deleteMany({ userId: user._id });
    const known = "654321";
    await EmailOtp.create({
      userId: user._id,
      email,
      purpose: "password_reset",
      codeHash: hashOtpCode(known, email),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts: 0,
      maxAttempts: 5,
      lastSentAt: new Date(),
      consumedAt: null,
    });

    await resetPasswordWithOtp(email, known, "newpass123");
    const afterReset = await User.findById(user._id);
    assert(
      afterReset!.passwordHash !== originalHash,
      "successful reset writes a new password hash",
    );
    assert(
      await bcrypt.compare("newpass123", afterReset!.passwordHash),
      "the new password verifies against the stored hash",
    );
    assert(
      !(await bcrypt.compare("oldpass123", afterReset!.passwordHash)),
      "the old password no longer verifies",
    );

    const consumed = await EmailOtp.findOne({
      userId: user._id,
      purpose: "password_reset",
    }).sort({ createdAt: -1 });
    assert(!!consumed?.consumedAt, "the used reset code is consumed");

    let reuseFailed = false;
    try {
      await resetPasswordWithOtp(email, known, "anotherpass");
    } catch {
      reuseFailed = true;
    }
    assert(reuseFailed, "a consumed reset code cannot be reused");
    const afterReuse = await User.findById(user._id);
    assert(
      await bcrypt.compare("newpass123", afterReuse!.passwordHash),
      "a reused-code attempt does not change the password again",
    );

    assert(
      PASSWORD_RESET_REQUEST_MESSAGE.includes("If an account exists"),
      "request copy is the generic existence-safe message",
    );
  } finally {
    await EmailOtp.deleteMany({
      userId: { $in: [user._id, suspended._id] },
    });
    await User.deleteMany({ _id: { $in: [user._id, suspended._id] } });
  }
}

async function main() {
  console.log("Phase 22 password reset verification\n");
  staticChecks();
  await dbChecks();
  console.log("\nPASS: Phase 22 checks");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
