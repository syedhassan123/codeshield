"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import {
  confirmPasswordResetAction,
  requestPasswordResetAction,
} from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordClient() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [pending, startTransition] = useTransition();

  const requestCode = () => {
    setError("");
    startTransition(async () => {
      const result = await requestPasswordResetAction({ email });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      setInfo(
        "message" in result && result.message
          ? result.message
          : "If an account exists for that email, we sent a code.",
      );
      setStep("confirm");
    });
  };

  const confirmReset = () => {
    setError("");
    startTransition(async () => {
      const result = await confirmPasswordResetAction({
        email,
        code,
        password,
        confirmPassword,
      });
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      const redirectTo =
        "redirectTo" in result && result.redirectTo
          ? result.redirectTo
          : "/?reset=1";
      window.location.assign(redirectTo);
    });
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
            <Mail className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-display font-bold text-2xl">Reset your password</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {step === "request"
              ? "Enter your email and we'll send a 6-digit reset code."
              : `Enter the code sent to ${email}, then choose a new password.`}
          </p>

          {step === "request" ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                requestCode();
              }}
            >
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@university.edu"
                  className="mt-1.5"
                  required
                  autoComplete="email"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Sending…" : "Send reset code"}
              </Button>
            </form>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                confirmReset();
              }}
            >
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Reset code
                </label>
                <Input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="6-digit code"
                  className="mt-1.5 tracking-widest"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  New password
                </label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 6 characters"
                  className="mt-1.5"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Confirm password
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repeat new password"
                  className="mt-1.5"
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? "Updating…" : "Update password"}
              </Button>
              <button
                type="button"
                className="w-full text-xs font-semibold text-primary hover:underline disabled:opacity-50"
                disabled={pending}
                onClick={requestCode}
              >
                Resend code
              </button>
            </form>
          )}

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
        </div>
      </div>
    </div>
  );
}
