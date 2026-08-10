"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Mail, ScanFace, ShieldCheck } from "lucide-react";
import {
  demoLoginAction,
  loginAction,
  registerAction,
  type AuthActionState,
} from "@/lib/actions/auth";
import type { UserRole } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initial: AuthActionState = {};

export function AuthPanel() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initial,
  );
  const [registerState, registerFormAction, registerPending] = useActionState(
    registerAction,
    initial,
  );
  const [demoPending, startDemo] = useTransition();
  const error = mode === "signin" ? loginState.error : registerState.error;

  return (
    <div className="card-soft p-6 sm:p-8 shadow-elevated">
      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-sm font-semibold transition",
            mode === "signin"
              ? "gradient-primary text-white shadow-glow"
              : "bg-muted text-muted-foreground",
          )}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={cn(
            "flex-1 py-2.5 rounded-xl text-sm font-semibold transition",
            mode === "signup"
              ? "gradient-primary text-white shadow-glow"
              : "bg-muted text-muted-foreground",
          )}
        >
          Create account
        </button>
      </div>

      <form
        action={mode === "signin" ? loginFormAction : registerFormAction}
        className="space-y-4"
      >
        {mode === "signup" && (
          <div>
            <label className="text-xs font-semibold text-muted-foreground">
              Full name
            </label>
            <Input
              name="name"
              placeholder="Your name"
              className="mt-1.5"
              required
            />
          </div>
        )}
        <div>
          <label className="text-xs font-semibold text-muted-foreground">
            Email
          </label>
          <div className="relative mt-1.5">
            <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="email"
              type="email"
              placeholder="you@university.edu"
              defaultValue="demo@codeshield.ai"
              className="pl-9"
              required
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-muted-foreground">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-1.5">
            <Eye className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="password"
              type="password"
              placeholder="••••••••"
              defaultValue="password123"
              className="pl-9"
              required
            />
          </div>
        </div>

        {mode === "signin" && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" className="rounded border-border" />
            Remember me
          </label>
        )}

        {error && (
          <div className="text-xs font-semibold text-danger bg-danger-soft px-3 py-2 rounded-lg">
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={loginPending || registerPending}
        >
          Continue to verification
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        Or quick-login as demo
        <div className="flex-1 h-px bg-border" />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {(["admin", "student", "interviewer"] as UserRole[]).map((role) => (
          <button
            key={role}
            type="button"
            disabled={demoPending}
            onClick={() => startDemo(() => demoLoginAction(role))}
            className="px-3 py-2.5 rounded-lg bg-primary-soft text-primary text-xs font-semibold capitalize transition hover:opacity-90"
          >
            {role === "admin" ? "Admin" : role === "student" ? "Student" : "Interviewer"}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <ScanFace className="w-4 h-4 text-primary" />
        <span>Secured with OTP & face verification</span>
      </div>
    </div>
  );
}
