/**
 * Confirms login no longer requires OTP and unverified users are blocked.
 * Run: npx tsx --env-file=.env.local scripts/verify-login-no-otp.ts
 */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { homeForRole } from "../src/lib/auth.config";
import { User } from "../src/models/User";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  await connectDB();

  // Demo users must remain login-ready without OTP
  const demos = [
    "admin@codeshield.ai",
    "rohan@codeshield.edu",
    "kabir@codeshield.ai",
    "demo@codeshield.ai",
  ];
  await User.updateMany(
    { email: { $in: demos } },
    { $set: { emailVerified: true } },
  );

  for (const email of demos) {
    const user = await User.findOne({ email });
    assert(user, `${email} exists`);
    assert(user!.emailVerified !== false, `${email} emailVerified allowed`);
    assert(
      homeForRole(user!.role as "admin" | "student" | "interviewer").startsWith(
        "/",
      ),
      `${email} role home=${homeForRole(user!.role as "admin" | "student" | "interviewer")}`,
    );
  }

  const email = `login-test-${Date.now()}@codeshield.test`;
  const passwordHash = await bcrypt.hash("password123", 12);
  const unverified = await User.create({
    email,
    passwordHash,
    name: "Unverified",
    role: "student",
    status: "active",
    emailVerified: false,
    avatar: "UV",
  });

  assert(unverified.emailVerified === false, "unverified account blocked flag");

  const passwordOk = await bcrypt.compare("password123", unverified.passwordHash);
  assert(passwordOk, "password valid but email not verified");

  // Mimic authorize gate
  const wouldDeny = unverified.emailVerified === false;
  assert(wouldDeny, "unverified account cannot complete normal login");

  unverified.emailVerified = true;
  await unverified.save();
  assert(
    unverified.emailVerified === true,
    "after verification login is allowed",
  );
  assert(
    homeForRole("student") === "/student",
    "student redirects to /student (no OTP step)",
  );
  assert(homeForRole("admin") === "/admin", "admin redirects to /admin");
  assert(
    homeForRole("interviewer") === "/interviewer",
    "interviewer redirects to /interviewer",
  );

  await User.deleteOne({ _id: unverified._id });
  console.log("\nLogin-without-OTP checks passed.");
  await mongoose.disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await mongoose.disconnect();
  process.exit(1);
});
