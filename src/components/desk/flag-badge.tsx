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

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return <Badge variant="outline">Unset</Badge>;
  const s = status.toLowerCase();
  if (s.includes("complete") || s === "installed" || s === "ready" || s === "phone resolved") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (s.includes("cancel") || s.includes("fell") || s.includes("overdue") || s.includes("not ready")) {
    return <Badge variant="danger">{status}</Badge>;
  }
  if (s.includes("progress") || s.includes("dispatch") || s.includes("await") || s.includes("follow")) {
    return <Badge variant="warn">{status}</Badge>;
  }
  return <Badge>{status}</Badge>;
}
