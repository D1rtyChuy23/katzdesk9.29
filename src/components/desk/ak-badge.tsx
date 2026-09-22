import { cn } from "@/lib/utils";

export function AkBadge({
  on,
  className,
}: {
  on?: boolean | null;
  className?: string;
}) {
  if (!on) return null;
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-sm bg-ink px-1.5 text-[10px] font-semibold tracking-wide text-cream",
        className,
      )}
      title="Avi Katz account"
    >
      AK
    </span>
  );
}

export function NoRepFlag({
  show,
  className,
}: {
  show?: boolean | null;
  className?: string;
}) {
  if (!show) return null;
  return (
    <span className={cn("text-[11px] font-medium text-warning", className)}>No rep assigned</span>
  );
}
