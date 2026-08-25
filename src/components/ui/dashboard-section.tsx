import { cn } from "@/lib/utils";

export function DashboardSection({
  title,
  meta,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("card-soft p-4 sm:p-5", className)}>
      {(title || action || meta) && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {title && (
              <h3 className="font-display font-semibold text-sm sm:text-base tracking-tight">
                {title}
              </h3>
            )}
            {meta && (
              <span className="text-[11px] font-medium text-muted-foreground">
                {meta}
              </span>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
