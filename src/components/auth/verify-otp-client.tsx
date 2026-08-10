"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function VerifyOtpClient({ email }: { email?: string | null }) {
  const router = useRouter();
  const { update } = useSession();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [seconds, setSeconds] = useState(45);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const onChange = async (index: number, value: string) => {
    const v = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = v;
    setDigits(next);
    if (v && index < 5) refs.current[index + 1]?.focus();

    if (next.every(Boolean)) {
      await update({ otpVerified: true });
      router.push("/verify-face");
      router.refresh();
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
            We sent a 6-digit code to{" "}
            <span className="font-semibold text-foreground">
              {email || "demo@codeshield.ai"}
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
                className="w-11 h-12 text-center rounded-xl border border-border bg-card text-lg font-bold outline-none focus:ring-2 focus:ring-primary/30"
                inputMode="numeric"
                maxLength={1}
              />
            ))}
          </div>

          <p className="mt-5 text-xs text-muted-foreground text-center">
            Resend in{" "}
            <span className="text-primary font-semibold">{seconds} s</span>
          </p>

          <Button
            className="w-full mt-6"
            onClick={async () => {
              await update({ otpVerified: true });
              router.push("/verify-face");
              router.refresh();
            }}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
