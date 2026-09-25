import Link from "next/link";
import { Award, Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import { createServerOp } from "@/lib/debug";
import { requirePageRole } from "@/lib/safe-auth";
import { listCertificatesForStudent } from "@/lib/certificates/queries";

export default async function StudentCertificatesPage() {
  const op = createServerOp({
    domain: "CERTIFICATE",
    operation: "PAGE_LIST",
    source: "SERVER-COMPONENT",
  });

  const session = await requirePageRole(["student"]);
  op.auth(session.user);
  op.allowed({ action: "list_certificates", role: session.user.role });
  await connectDB();

  const certificates = await op.runMongo("list certificates for student page", () =>
    listCertificatesForStudent(session.user.id),
  );
  op.respond({ count: certificates.length });

  return (
    <div>
      <PageHeader
        title="Certificates"
        description="Earned credentials you can share with employers."
      />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {certificates.map((c) => (
          <div key={c.id} className="card-soft p-5">
            <div className="text-[11px] font-semibold text-primary mb-2 flex items-center gap-1">
              <Award className="w-3.5 h-3.5" /> Certificate of Achievement
            </div>
            <h3 className="font-display font-bold text-lg">
              {c.assessmentTitle}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-2">
              Issued {new Date(c.issuedAt).toLocaleDateString()}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold">
                Score {c.score.toFixed(0)}%
              </span>
              <Button asChild variant="outline" size="sm">
                <Link href={`/student/certificates/${c.id}`}>
                  <Download className="w-3.5 h-3.5" /> View
                </Link>
              </Button>
            </div>
          </div>
        ))}

        {!certificates.length && (
          <div className="card-soft p-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-3">
            No certificates yet. Pass a graded assessment to earn one.
          </div>
        )}
      </div>
    </div>
  );
}
