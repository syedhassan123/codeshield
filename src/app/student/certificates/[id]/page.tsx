import { notFound } from "next/navigation";
import { Award } from "lucide-react";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import { getOwnedCertificate } from "@/lib/certificates/queries";
import { CertificatePrintButton } from "@/components/certificates/certificate-print-button";

export default async function StudentCertificateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const op = createServerOp({
    domain: "CERTIFICATE",
    operation: "PAGE_DETAIL",
    source: "SERVER-COMPONENT",
    resourceId: id,
  });

  // Ownership is enforced independently of the list page — direct
  // navigation to another student's certificate URL must 404 here too.
  const session = await requirePageRole(["student"]);
  op.auth(session.user);
  await connectDB();

  const certificate = await op.runMongo("load owned certificate", () =>
    getOwnedCertificate(id, session.user.id),
  );

  console.log("Certificates",certificate)

  if (!certificate) {
    op.denied({ action: "view_certificate", reason: "NOT_FOUND_OR_NOT_OWNER" });
    notFound();
  }

  op.allowed({ action: "view_certificate", role: session.user.role });
  op.respond({ certificateId: certificate.id });

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-6 print:bg-white print:p-0">
      <div className="w-full max-w-2xl">
        <div className="mb-4 flex justify-end print:hidden">
          <CertificatePrintButton />
        </div>

        <div className="card-soft border-4 border-primary/20 p-10 text-center bg-white print:border-2 print:shadow-none">
          <div className="w-14 h-14 rounded-full bg-primary-soft text-primary flex items-center justify-center mx-auto mb-4">
            <Award className="w-7 h-7" />
          </div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
            Certificate of Achievement
          </p>
          <h1 className="font-display font-bold text-3xl mt-3">
            {certificate.assessmentTitle}
          </h1>
          <p className="text-sm text-muted-foreground mt-4">
            Awarded for successfully completing this assessment with a score
            of
          </p>
          <p className="font-display font-bold text-4xl text-primary mt-1">
            {certificate.score.toFixed(0)}%
          </p>
          <p className="text-[11px] text-muted-foreground mt-6">
            Issued {new Date(certificate.issuedAt).toLocaleDateString()} ·
            Pass threshold {certificate.passThreshold}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-8 font-mono">
            Certificate ID: {certificate.certificateSerial}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Verify at yourdomain.com/verify/{certificate.certificateSerial}
          </p>
        </div>
      </div>
    </div>
  );
}
