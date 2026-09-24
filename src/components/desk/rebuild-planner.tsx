import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatShortDate, todayChicago } from "@/lib/ops/clock";
import { HEALTH_LABEL, updateRebuild, type Rebuild } from "@/lib/ops/rebuilds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { OwnerFilter } from "./owner-select";
import { sameTech } from "@/lib/ops/tech-match";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const WINDOW = 42;

function barRange(r: Rebuild): { start: string; end: string } | null {
  const start = r.actualStart || r.plannedStart || r.createdAt.slice(0, 10);
  const end = r.actualComplete || r.targetComplete;
  if (!start && !end) return null;
  if (start && end) return { start, end: end < start ? start : end };
  if (start) return { start, end: addDays(start, 7) };
  return { start: end!, end: end! };
}

export function RebuildPlanner({
  rows,
  canEdit,
  onOpen,
}: {
  rows: Rebuild[];
  canEdit: boolean;
  onOpen: (id: number) => void;
}) {
  const today = todayChicago();
  const [anchor, setAnchor] = useState(addDays(today, -7));
  const windowEnd = addDays(anchor, WINDOW - 1);
  const [owner, setOwner] = useState("");
  const [health, setHealth] = useState("");
  const [account, setAccount] = useState("");
  const [equip, setEquip] = useState("");
  const qc = useQueryClient();
  const saveDate = useMutation({
    mutationFn: (d: { id: number; targetComplete: string | null }) => updateRebuild({ data: d }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["rebuilds"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update date"),
  });

  const list = useMemo(() => {
    let next = rows.filter((r) => r.status !== "Cancelled");
    if (owner) next = next.filter((r) => sameTech(r.owner, owner) || (r.owner ?? "").trim() === owner);
    if (health) next = next.filter((r) => r.health === health);
    if (account.trim()) {
      const n = account.trim().toLowerCase();
      next = next.filter((r) => r.account.toLowerCase().includes(n));
    }
    if (equip.trim()) {
      const n = equip.trim().toLowerCase();
      next = next.filter((r) => (r.equipment ?? "").toLowerCase().includes(n));
    }
    return next;
  }, [rows, owner, health, account, equip]);

  const ticks = [0, 7, 14, 21, 28, 35].map((d) => addDays(anchor, d));

  function pos(iso: string): number {
    const days = Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${anchor}T00:00:00Z`)) / 86400000);
    return Math.max(0, Math.min(WINDOW, days));
  }

  const weekHits = new Map<string, number>();
  for (const r of list) {
    const range = barRange(r);
    if (!range) continue;
    const s = pos(range.start);
    const e = pos(range.end);
    const startWeek = Math.floor(s / 7);
    const endWeek = Math.floor(Math.max(s, e - 0.01) / 7);
    for (let w = startWeek; w <= endWeek; w++) {
      const key = `${r.owner || "unassigned"}:${w}`;
      weekHits.set(key, (weekHits.get(key) ?? 0) + 1);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl">Rebuild timeline</h2>
          <p className="text-xs text-muted-foreground">
            {formatShortDate(anchor)} – {formatShortDate(windowEnd)}. Overdue bars read as overdue. Same records as the board.
          </p>
        </div>
        <div className="flex gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, -7))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(addDays(today, -7))}>
            Today
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setAnchor(addDays(anchor, 7))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-4">
        <OwnerFilter value={owner} onChange={setOwner} />
        <select
          className="h-10 rounded-md border border-input bg-card px-3 text-sm"
          value={health}
          onChange={(e) => setHealth(e.target.value)}
        >
          <option value="">Any health</option>
          {(["overdue", "at-risk", "no-date", "on-track", "done"] as const).map((h) => (
            <option key={h} value={h}>
              {HEALTH_LABEL[h]}
            </option>
          ))}
        </select>
        <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Account" />
        <Input value={equip} onChange={(e) => setEquip(e.target.value)} placeholder="Equipment" />
      </div>
      <div className="mt-4 overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="mb-1 grid grid-cols-[11rem_1fr] text-[11px] text-muted-foreground">
            <span />
            <div className="relative h-5">
              {ticks.map((d, i) => (
                <span key={d} className="absolute -translate-x-1/2" style={{ left: `${(i / 6) * 100}%` }}>
                  {formatShortDate(d)}
                </span>
              ))}
            </div>
          </div>
          <ul className="space-y-1.5">
            {list.map((r) => {
              const range = barRange(r);
              const start = range ? pos(range.start) : 0;
              const end = range ? pos(range.end) : 0;
              const left = (start / WINDOW) * 100;
              const width = Math.max(2, ((Math.max(end, start + 1) - start) / WINDOW) * 100);
              const todayLeft = (pos(today) / WINDOW) * 100;
              const overlap =
                range && (weekHits.get(`${r.owner || "unassigned"}:${Math.floor(start / 7)}`) ?? 0) > 1;
              return (
                <li key={r.id} className="grid grid-cols-[11rem_1fr] items-center gap-2">
                  <button type="button" className="min-w-0 truncate text-left text-xs hover:underline" onClick={() => onOpen(r.id)}>
                    <span className="font-medium">{r.account}</span>
                    <span className="block truncate text-muted-foreground">{r.equipment || r.title}</span>
                  </button>
                  <div className="relative h-8 rounded-md bg-muted/60">
                    <span className="absolute inset-y-0 w-px bg-foreground/40" style={{ left: `${todayLeft}%` }} />
                    {range ? (
                      <button
                        type="button"
                        onClick={() => onOpen(r.id)}
                        title={`${r.title} · ${range.start} → ${range.end}`}
                        className={cn(
                          "absolute top-1 h-6 rounded-md px-2 text-left text-[10px] leading-6 text-cream",
                          r.health === "overdue" ? "bg-destructive" : r.health === "at-risk" || r.health === "no-date" ? "bg-warning" : "bg-primary",
                          overlap && "ring-2 ring-warning",
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <span className="block truncate">{r.title}</span>
                      </button>
                    ) : (
                      <span className="absolute inset-y-0 left-2 flex items-center text-[10px] text-muted-foreground">No dates</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {canEdit ? (
            <ul className="mt-3 space-y-1">
              {list
                .filter((r) => r.status !== "Completed")
                .slice(0, 12)
                .map((r) => (
                  <li key={`date-${r.id}`} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="w-40 truncate">{r.title}</span>
                    <Badge variant="outline">{HEALTH_LABEL[r.health]}</Badge>
                    <Input
                      type="date"
                      className="h-8 w-40"
                      value={r.targetComplete ?? ""}
                      onChange={(e) => saveDate.mutate({ id: r.id, targetComplete: e.target.value || null })}
                    />
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
}
