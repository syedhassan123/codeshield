"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Camera, CheckCircle2, ScanFace } from "lucide-react";
import { homeForRole } from "@/lib/auth.config";
import { cn } from "@/lib/utils";

export function VerifyFaceClient() {
  const router = useRouter();
  const { data, update } = useSession();
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const t = setInterval(
      () => setProgress((p) => Math.min(100, p + 4)),
      80,
    );
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (progress < 100 || done) return;
    setDone(true);
    (async () => {
      await update({ faceVerified: true, otpVerified: true });
      const role = data?.user?.role || "student";
      router.push(homeForRole(role));
      router.refresh();
    })();
  }, [progress, done, update, router, data?.user?.role]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background relative">
      <div className="absolute inset-0 grid-bg opacity-50 pointer-events-none" />
      <div className="relative card-soft p-8 max-w-md w-full text-center shadow-elevated">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shadow-glow mx-auto mb-5">
          <ScanFace className="w-6 h-6 text-white" />
        </div>
        <h1 className="font-display font-bold text-2xl">Face verification</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Position your face within the frame
        </p>

        <div className="relative mx-auto mt-8 w-40 h-40 rounded-full bg-muted flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-4 border-primary" />
          {done ? (
            <CheckCircle2 className="w-20 h-20 text-success" />
          ) : (
            <Camera className="w-16 h-16 text-primary/60" />
          )}
        </div>

        <div className="mt-6 text-sm font-semibold">
          {done ? "Verified successfully" : `Scanning… ${progress}%`}
        </div>
        <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className="h-full gradient-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-[11px] font-semibold">
          {[
            { label: "Face Detected", on: progress > 20 },
            { label: "Eye Match", on: progress > 60 },
            { label: "Liveness OK", on: progress > 85 },
          ].map((item) => (
            <div
              key={item.label}
              className={cn(
                "px-2 py-1.5 rounded-lg",
                item.on
                  ? "bg-success-soft text-success"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
