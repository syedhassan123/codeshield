import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
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
            Enter your email and we&apos;ll send you a recovery link.
          </p>
          <form className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@university.edu"
                className="mt-1.5"
              />
            </div>
            <Button type="button" className="w-full">
              Send recovery link
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
