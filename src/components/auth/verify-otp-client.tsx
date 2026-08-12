"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { sendOtpAction, verifyOtpAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";

export function VerifyOtpClient({ email }: { email?: string | null }) {
  const router = useRouter();
  const { update } = useSession();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(60);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, startTransition] = useTransition();
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const verifying = useRef(false);
  const sendStarted = useRef(false);

  const sendCode = (isResend = false) => {
    if (!isResend && sendStarted.current) return;
    if (!isResend) sendStarted.current = true;

    setError("");
    startTransition(async () => {
      const result = await sendOtpAction();
      if ("error" in result && result.error) {
        setError(result.error);
        if (!isResend) sendStarted.current = false;
        return;
      }
      if ("alreadyVerified" in result && result.alreadyVerified) {
        window.location.assign("/");
        return;
      }
      setSeconds(60);
      const successMessage =
        "message" in result && result.message
          ? result.message
          : "Verification code sent.";
      setInfo(isResend ? "A new code was sent." : successMessage);
    });
  };

  useEffect(() => {
    sendCode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const submitCode = (code: string) => {
    if (verifying.current || code.length !== 6) return;
    verifying.current = true;
    setError("");
    startTransition(async () => {
      try {
        const result = await verifyOtpAction({ code });
        if ("error" in result && result.error) {
          setError(result.error);
          verifying.current = false;
          return;
        }

        // Sync JWT from DB (ignores forged client otpVerified flags).
        const session = await update({ refreshOtpStatus: true });
        const redirectTo =
          "redirectTo" in result && result.redirectTo
            ? result.redirectTo
            : "/";

        if (!session?.user?.otpVerified) {
          setError(
            "Code accepted, but session sync failed. Please try again or refresh.",
          );
          verifying.current = false;
          return;
        }

        // Full navigation so middleware sees updated JWT cookie.
        window.location.assign(redirectTo);
      } catch {
        setError("Verification failed. Try again.");
        verifying.current = false;
      }
    });
  };

  const onChange = (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) refs.current[index + 1]?.focus();
    if (next.every(Boolean)) {
      submitCode(next.join(""));
    }
  };

  const onKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative">
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
      <div className="relative w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </Link>
        <div className="card-soft p-8 shadow-elevated">
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow mb-5">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl">Verify your email</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Enter the 6-digit code we sent to{" "}
            <span className="font-semibold text-foreground">
              {email || "your email"}
            </span>
          </p>

          <div className="mt-6 flex gap-2 justify-between">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  refs.current[i] = el;
                }}
                value={d}
                onChange={(e) => onChange(i, e.target.value)}
                onKeyDown={(e) => onKeyDown(i, e)}
                className="w-11 h-12 text-center rounded-xl border border-border bg-card text-lg font-bold outline-none focus:ring-2 focus:ring-primary/30"
                inputMode="numeric"
                maxLength={1}
                disabled={pending}
                autoComplete="one-time-code"
              />
            ))}
          </div>

          {error && (
            <p className="mt-4 text-xs font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          {info && !error && (
            <p className="mt-4 text-xs font-semibold text-primary bg-primary-soft px-3 py-2 rounded-lg">
              {info}
            </p>
          )}

          <p className="mt-5 text-xs text-muted-foreground text-center">
            {seconds > 0 ? (
              <>
                Resend in{" "}
                <span className="text-primary font-semibold">{seconds}s</span>
              </>
            ) : (
              <button
                type="button"
                className="text-primary font-semibold hover:underline disabled:opacity-50"
                disabled={pending}
                onClick={() => sendCode(true)}
              >
                Resend code
              </button>
            )}
          </p>

          <Button
            className="w-full mt-6"
            disabled={pending || digits.some((d) => !d)}
            onClick={() => submitCode(digits.join(""))}
          >
            {pending ? "Verifying…" : "Verify & continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
