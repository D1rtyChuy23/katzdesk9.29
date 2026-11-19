/**
 * A unit's or an install's equipment history (11/19): who, when, what changed, from what to what. Read only: the
 * history can't be edited or deleted. Shown in the unit's Edit and on the install's Equipment tab.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getInstallHistory, getUnitHistory, historyActionLabel, historyFieldLabel, type HistoryEntry } from "@/lib/ops/unit-history";

function line(e: HistoryEntry): string {
  const field = historyFieldLabel(e.field);
  if (e.action === "remove" || e.action === "retire" || e.action === "merge") return [e.oldValue, e.note].filter(Boolean).join(" · ");
  if (e.action === "add_to_install") return e.newValue ?? "";
  if (e.action === "remove_from_install") return e.oldValue ?? "";
  if (e.action === "create" || e.action === "put_back") return `${field}: ${e.newValue ?? ""}`;
  return `${field}: ${e.oldValue ?? "blank"} → ${e.newValue ?? "blank"}`;
}

export function EquipmentHistoryList({ unitId, installId, defaultOpen = false }: { unitId?: number; installId?: number; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const q = useQuery({
    queryKey: unitId ? ["equipment-history", "unit", unitId] : ["equipment-history", "install", installId],
    queryFn: () => (unitId ? getUnitHistory({ data: { unitId } }) : getInstallHistory({ data: { installId: installId! } })),
    enabled: open && !!(unitId || installId),
  });
  return (
    <section className="mt-3" data-testid="equipment-history">
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => setOpen((o) => !o)} aria-expanded={open} data-testid="equipment-history-toggle">
        <History className="size-4" />
        {open ? "Hide history" : "History"}
      </Button>
      {open ? (
        q.isPending ? (
          <p className="mt-1 text-xs text-muted-foreground">Loading…</p>
        ) : q.isError ? (
          <p className="mt-1 text-xs text-destructive">Couldn't load the history.</p>
        ) : !q.data?.length ? (
          <p className="mt-1 text-xs text-muted-foreground" data-testid="equipment-history-empty">
            Nothing recorded yet. Changes are recorded from 11/19 on.
          </p>
        ) : (
          <ol className="mt-1 max-h-72 space-y-1 overflow-auto text-xs" data-testid="equipment-history-rows">
            {q.data.map((e) => (
              <li key={e.id} className="rounded border border-border/60 px-2 py-1" data-testid="equipment-history-row">
                <span className="text-muted-foreground">
                  {e.at} · {e.actor} ·{" "}
                </span>
                <span className="font-medium">{historyActionLabel(e.action)}</span>
                {installId && e.unitId && e.field !== "install" && e.field !== "equipment list" ? <span className="text-muted-foreground"> · unit #{e.unitId}</span> : null}
                <span className="break-words"> · {line(e)}</span>
              </li>
            ))}
          </ol>
        )
      ) : null}
    </section>
  );
}
