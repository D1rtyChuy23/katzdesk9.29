import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { listActivity } from "@/lib/ops/api";
import { cn } from "@/lib/utils";

function actionLine(action: string, detail: string | null): string {
  if (action === "opened") return detail ? `opened this · ${detail}` : "opened this";
  if (action === "note") return detail ? `left a note · ${detail}` : "left a note";
  if (action === "status") return detail ?? "updated status";
  if (action === "reason") return detail ?? "updated reason delayed";
  if (action === "assigned-asset") return detail ?? "assigned equipment";
  if (action === "unassigned-asset") return detail ? `removed ${detail}` : "removed equipment";
  if (action === "returned") return detail ? `returned to ${detail}` : "returned to warehouse";
  if (action === "sold") return detail ? `sold to ${detail}` : "marked sold";
  if (action === "updated") return detail ?? "saved changes";
  return detail || action;
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function ActivityTrail({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const [open, setOpen] = useState(false);
  const log = useQuery({
    queryKey: ["activity", entityType, entityId],
    queryFn: () => listActivity({ data: { entityType, entityId } }),
    refetchInterval: open ? 8_000 : false,
    enabled: open,
  });
  const rows = log.data ?? [];
  return (
    <div className="border-t border-border px-5 py-3">
      <button
        type="button"
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        data-testid="who-changed"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-display text-base font-medium">Who changed this</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        log.isLoading ? (
          <p className="mt-2 text-sm text-muted-foreground">Loading…</p>
        ) : rows.length ? (
          <ol className="mt-2 space-y-2">
            {rows.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <p className="min-w-0">
                  <span className="font-medium">@{a.actorName ?? "teammate"}</span>
                  <span className="text-muted-foreground"> {actionLine(a.action, a.detail)}</span>
                </p>
                <time className="shrink-0 text-xs text-muted-foreground">{when(a.createdAt)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No changes yet.</p>
        )
      ) : null}
    </div>
  );
}
