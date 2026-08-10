import { ShieldCheck } from "lucide-react";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
        <ShieldCheck className="w-5 h-5 text-white" />
      </div>
      {!compact && (
        <div>
          <div className="font-display font-bold leading-tight text-[15px]">
            CodeShield
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            AI Platform
          </div>
        </div>
      )}
    </div>
  );
}
