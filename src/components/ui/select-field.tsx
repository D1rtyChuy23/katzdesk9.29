import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function SelectField({
  className,
  children,
  allowEmpty,
  emptyLabel = "—",
  ...props
}: ComponentProps<"select"> & { allowEmpty?: boolean; emptyLabel?: string }) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    >
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {children}
    </select>
  );
}
