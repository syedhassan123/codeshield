import { cn } from "@/lib/utils";

export function Label({
  className,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "text-xs font-semibold text-muted-foreground block mb-1.5",
        className,
      )}
      {...props}
    />
  );
}
