"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Browser-native print → "Save as PDF", no PDF library dependency. */
export function CertificatePrintButton() {
  return (
    <Button
      size="sm"
      className="print:hidden"
      onClick={() => window.print()}
    >
      <Download className="w-3.5 h-3.5" /> Download / Print
    </Button>
  );
}
