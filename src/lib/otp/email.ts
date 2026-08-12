import nodemailer from "nodemailer";
import { debugError, debugLog, maskEmail } from "@/lib/debug";

export async function sendOtpEmail(options: {
  to: string;
  code: string;
  name?: string;
}) {
  const from =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    "CodeShield AI <noreply@codeshield.ai>";

  const subject = "Your CodeShield verification code";
  const text = [
    `Hi${options.name ? ` ${options.name}` : ""},`,
    "",
    `Your verification code is: ${options.code}`,
    "",
    "This code expires in 10 minutes.",
    "If you did not request this, you can ignore this email.",
  ].join("\n");

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5">
      <h2>CodeShield verification</h2>
      <p>Hi${options.name ? ` ${options.name}` : ""},</p>
      <p>Your verification code is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:6px">${options.code}</p>
      <p>This code expires in 10 minutes.</p>
    </div>
  `;

  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Dev fallback: no SMTP configured — log code server-side only (never to client).
  if (!host || !user || !pass) {
    debugLog("AUTH", "OTP_EMAIL_DEV_FALLBACK", {
      to: maskEmail(options.to),
      note: "SMTP not configured; code logged for local testing only",
    });
    if (process.env.NODE_ENV === "development" || process.env.DEBUG_LOGS === "true") {
      console.log(`[AUTH] DEV OTP for ${maskEmail(options.to)}: ${options.code}`);
    }
    return { delivered: false as const, mode: "dev_fallback" as const };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: options.to,
      subject,
      text,
      html,
    });

    debugLog("AUTH", "OTP_EMAIL_SENT", { to: maskEmail(options.to) });
    return { delivered: true as const, mode: "smtp" as const };
  } catch (error) {
    debugError("Failed to send OTP email", error, {
      to: maskEmail(options.to),
    });
    throw error;
  }
}
