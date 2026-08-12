import { createHash, randomInt } from "crypto";

export function generateOtpCode(length = 6) {
  const max = 10 ** length;
  const min = 10 ** (length - 1);
  return String(randomInt(min, max));
}

export function hashOtpCode(code: string, email: string) {
  const secret = process.env.AUTH_SECRET || "codeshield-otp-fallback";
  return createHash("sha256")
    .update(`${secret}:${email.toLowerCase()}:${code}`)
    .digest("hex");
}

export function verifyOtpCode(code: string, email: string, codeHash: string) {
  return hashOtpCode(code, email) === codeHash;
}
