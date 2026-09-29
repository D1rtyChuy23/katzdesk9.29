import { Badge } from "@/components/ui/badge";
import type { ClockFlag } from "@/lib/ops/clock";

export function FlagBadge({ flag }: { flag: ClockFlag | null | undefined }) {
  if (!flag) return null;
  const variant = flag.level === "danger" ? "danger" : flag.level === "warn" ? "warn" : "default";
  return <Badge variant={variant}>{flag.label}</Badge>;
}

export function UrgencyBadge({ urgency }: { urgency: string | null | undefined }) {
  if (!urgency) return null;
  const s = urgency.toLowerCase();
  if (s === "emergency") return <Badge variant="danger">{urgency}</Badge>;
  if (s === "high") return <Badge variant="warn">{urgency}</Badge>;
  if (s === "low") return <Badge variant="outline">{urgency}</Badge>;
  if (s === "normal") return <Badge variant="outline">{urgency}</Badge>;
  return <Badge>{urgency}</Badge>;
}

export function DuplicateBadge({
  duplicateOf,
  siblingCount,
}: {
  duplicateOf?: number | null;
  siblingCount?: number;
}) {
  if (duplicateOf) return <Badge variant="warn">Merged duplicate</Badge>;
  if (siblingCount && siblingCount > 0) return <Badge variant="warn">Possible duplicate</Badge>;
  return null;
}

export function StatusBadge({
  status,
  tight = false,
  className,
}: {
  status: string | null | undefined;
  tight?: boolean;
  className?: string;
}) {
  const size = tight ? "tight" : "default";
  if (!status) return <Badge variant="outline" size={size} className={className}>Unset</Badge>;
  const s = status.toLowerCase();
  let variant: "default" | "primary" | "danger" | "warn" | "success" | "outline" | "ink" = "default";
  if (s.includes("complete") || s === "installed" || s === "ready" || s === "phone resolved") variant = "success";
  else if (s.includes("cancel") || s.includes("fell") || s.includes("overdue") || s.includes("not ready")) variant = "danger";
  else if (s.includes("needs bay") || s.includes("serial missing")) variant = "warn";
  else if (s.includes("progress") || s.includes("dispatch") || s.includes("await") || s.includes("follow")) variant = "warn";
  else if (s === "pending review" || s === "pending removal" || s === "pending outbound") variant = "warn";
  else if (s === "needs test") variant = "outline";
  else if (s === "tested") variant = "primary";
  return (
    <Badge variant={variant} size={size} className={className}>
      {status}
    </Badge>
  );
}
