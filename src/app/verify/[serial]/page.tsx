import Link from "next/link";
import { CheckCircle2, ShieldAlert, ShieldX } from "lucide-react";
import { connectDB } from "@/lib/db";
import { verifyCertificateBySerial } from "@/lib/certificates/public";

export default async function VerifyCertificateResultPage({
  params,
}: {
  params: Promise<{ serial: string }>;
}) {
  const { serial } = await params;

  await connectDB();
  const result = await verifyCertificateBySerial(decodeURIComponent(serial));

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <div className="w-full max-w-md card-soft p-8 text-center">
        {result.valid ? (
          <>
            <div className="w-14 h-14 rounded-full bg-success-soft text-success flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h1 className="font-display font-bold text-xl">
              Certificate verified
            </h1>
            <p className="text-sm text-muted-foreground mt-1 mb-6">
              This is a genuine CodeShield AI certificate.
            </p>
            <div className="rounded-xl border border-border bg-card p-4 text-left space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Issued to:</span>{" "}
                <span className="font-semibold">{result.studentName}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Assessment:</span>{" "}
                <span className="font-semibold">
                  {result.assessmentTitle}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Score:</span>{" "}
                <span className="font-semibold">
                  {result.score.toFixed(0)}%
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Issued on:</span>{" "}
                <span className="font-semibold">
                  {new Date(result.issuedAt).toLocaleDateString()}
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono pt-1">
                {result.certificateSerial}
              </div>
            </div>
          </>
        ) : result.status === "revoked" ? (
          <>
            <div className="w-14 h-14 rounded-full bg-danger-soft text-danger flex items-center justify-center mx-auto mb-4">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h1 className="font-display font-bold text-xl">
              Certificate revoked
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              This certificate ID was previously issued but has since been
              revoked and is no longer valid.
            </p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-7 h-7" />
            </div>
            <h1 className="font-display font-bold text-xl">
              Certificate not found
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              No certificate matches this ID. Double-check it was copied
              correctly.
            </p>
          </>
        )}

        <Link
          href="/verify"
          className="inline-block mt-6 text-sm font-semibold text-primary"
        >
          Verify another certificate
        </Link>
      </div>
    </div>
  );
}
