import { useMemo, useState } from "react";
import { formatShortDate, money } from "@/lib/ops/clock";
import { findRep, formatRep, sameRep } from "@/lib/ops/rep-match";
import type { Deal } from "@/lib/ops/types";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "./flag-badge";
import { cn } from "@/lib/utils";

type Filter = "open" | "complete" | "all";

function stageLabel(d: Deal): string {
  if (d.completion === "complete") return "Complete";
  if (d.completion === "fell") return "Fell through";
  if (d.ordered) return "Ordered";
  if (d.goodToOrder) return "Good to order";
  return "Needs good to order";
}

function isOpen(d: Deal) {
  return d.completion !== "complete" && d.completion !== "fell";
}

/** A clickable rep name. Looks like text, behaves like a control. */
export function RepLink({
  name,
  onPick,
  className,
  children,
}: {
  name: string;
  onPick: (rep: string) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onPick(name);
      }}
      title={`Show ${formatRep(name) || name}'s deals`}
      className={cn(
        "cursor-pointer rounded-sm text-left underline decoration-border decoration-dotted underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {children ?? formatRep(name) ?? name}
    </button>
  );
}

/**
 * One rep's deals in a side panel over the Pipeline page. Closing it drops you back on
 * the full pipeline exactly where you were.
 */
export function RepDealsPanel({
  rep,
  deals,
  onClose,
  onOpenDeal,
}: {
  rep: string | null;
  deals: Deal[];
  onClose: () => void;
  onOpenDeal: (id: number) => void;
}) {
  const [filter, setFilter] = useState<Filter>("open");
  const mine = useMemo(
    () =>
      rep
        ? deals
            .filter((d) => sameRep(d.producer, rep))
            .sort((a, b) => (b.dateOfDeal ?? b.updatedAt).localeCompare(a.dateOfDeal ?? a.updatedAt))
        : [],
    [deals, rep],
  );
  const open = mine.filter(isOpen);
  const done = mine.filter((d) => d.completion === "complete");
  const shown = filter === "open" ? open : filter === "complete" ? done : mine;
  const total = (rows: Deal[]) => rows.reduce((n, d) => n + (d.amount ?? 0), 0);
  const info = findRep(rep);

  return (
    <Sheet open={!!rep} onOpenChange={(v) => (v ? null : onClose())}>
      <SheetContent data-testid="rep-deals-panel">
        <SheetHeader>
          <p className="text-[11px] font-semibold tracking-[0.16em] text-copper uppercase">Sales rep</p>
          <SheetTitle className="mt-1 flex items-center gap-2.5 font-display text-2xl">
            {info ? (
              <span className="grid size-9 place-items-center rounded-full bg-primary/12 text-sm font-semibold text-primary">
                {info.initials}
              </span>
            ) : null}
            {info?.name ?? rep}
          </SheetTitle>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(
              [
                ["open", "Open", open.length, total(open)],
                ["complete", "Complete", done.length, total(done)],
                ["all", "All deals", mine.length, total(mine)],
              ] as const
            ).map(([id, label, n, dollars]) => (
              <button
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left",
                  filter === id ? "border-primary/60 bg-primary/8 ring-1 ring-primary/30" : "border-border bg-card",
                )}
              >
                <span className="block text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{label}</span>
                <span className="block font-display text-xl tabular">{n}</span>
                <span className="block text-[11px] text-muted-foreground tabular">{money(dollars)}</span>
              </button>
            ))}
          </div>
        </SheetHeader>
        <SheetBody>
          {shown.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">No deals in this view.</p>
          ) : (
            <ul className="divide-y divide-border">
              {shown.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => onOpenDeal(d.id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-5 py-3 text-left hover:bg-muted/60"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{d.customer}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {d.equipment?.replace(/\r?\n/g, " · ") || "No equipment listed"}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-medium tabular">{money(d.amount)}</span>
                      <span className="block text-[11px] text-muted-foreground tabular">
                        {d.dateOfDeal ? formatShortDate(d.dateOfDeal) : "No date"}
                      </span>
                    </span>
                    <span className="col-span-2">
                      <StatusBadge status={stageLabel(d)} tight />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
