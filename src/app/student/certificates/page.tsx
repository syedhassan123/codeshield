import { Download } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { mockCertificates } from "@/lib/mock-data";

export default function StudentCertificatesPage() {
  return (
    <div>
      <PageHeader
        title="Certificates"
        description="Earned credentials you can share with employers."
      />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {mockCertificates.map((c) => (
          <div key={c.title} className="card-soft p-5">
            <div className="text-[11px] font-semibold text-primary mb-2">
              Certificate of Achievement
            </div>
            <h3 className="font-display font-bold text-lg">{c.title}</h3>
            <p className="text-[11px] text-muted-foreground mt-2">
              Issued {c.issued}
            </p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold">Score {c.score} %</span>
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5" /> Download
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
