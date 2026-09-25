"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function VerifyCertificatePage() {
  const router = useRouter();
  const [serial, setSerial] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = serial.trim();
    if (!trimmed) return;
    router.push(`/verify/${encodeURIComponent(trimmed)}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md card-soft p-8">
        <div className="w-12 h-12 rounded-xl bg-primary-soft text-primary flex items-center justify-center mb-4">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="font-display font-bold text-xl">Verify a certificate</h1>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Enter the certificate ID printed on a CodeShield AI certificate to
          confirm it&apos;s authentic.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="serial">Certificate ID</Label>
            <Input
              id="serial"
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="CERT-2026-xxxxxxxxxxxx"
              autoFocus
            />
          </div>
          <Button type="submit" className="w-full" disabled={!serial.trim()}>
            Verify
          </Button>
        </form>
      </div>
    </div>
  );
}
