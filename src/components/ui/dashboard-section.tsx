// import { cn } from "@/lib/utils";

// export function DashboardSection({
//   title,
//   meta,
//   action,
//   children,
//   className,
//   bodyClassName,
// }: {
//   title?: string;
//   meta?: React.ReactNode;
//   action?: React.ReactNode;
//   children: React.ReactNode;
//   className?: string;
//   bodyClassName?: string;
// }) {
//   return (
//     <section className={cn("card-soft p-4 sm:p-5", className)}>
//       {(title || action || meta) && (
//         <div className="flex flex-wrap items-center justify-between gap-2 mb-3 sm:mb-4">
//           <div className="flex flex-wrap items-center gap-2 min-w-0">
//             {title && (
//               <h3 className="font-display font-semibold text-sm sm:text-base tracking-tight">
//                 {title}
//               </h3>
//             )}
//             {meta && (
//               <span className="text-[11px] font-medium text-muted-foreground">
//                 {meta}
//               </span>
//             )}
//           </div>
//           {action}
//         </div>
//       )}
//       <div className={bodyClassName}>{children}</div>
//     </section>
//   );
// }











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
    <section
      className={cn(
        "relative flex flex-col overflow-hidden rounded-2xl border border-white/70 bg-card/80 p-4 ring-1 ring-black/[0.035] backdrop-blur-xl sm:p-5",
        // soft glass highlight along the top edge, kept behind the content
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-28 before:bg-gradient-to-b before:from-white/50 before:to-transparent",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset,0_10px_30px_-16px_rgba(30,41,90,0.16)]",
        "transition-[box-shadow,border-color] duration-300 ease-out",
        "hover:border-primary/20 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.8)_inset,0_20px_44px_-22px_rgba(79,85,243,0.3)]",
        className,
      )}
    >
      {(title || action || meta) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 sm:mb-4">
          <div className="flex min-w-0 flex-wrap items-center gap-2.5">
            {title && (
              <h3 className="font-display text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
                {title}
              </h3>
            )}
            {meta && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {meta}
              </span>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={cn("min-w-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}