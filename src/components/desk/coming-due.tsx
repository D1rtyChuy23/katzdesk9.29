import { useMemo, useState } from "react";
import { formatShortDate } from "@/lib/ops/clock";
import type { ComingDueCounts, ComingDueRow } from "@/lib/ops/types";
import { OpenLink } from "./open-link";
import { AkBadge, NoRepFlag } from "./ak-badge";
import { StatusBadge } from "./flag-badge";
import { cn } from "@/lib/utils";

type Bucket = "overdue" | "today" | "week" | "later";

const BUCKETS: { id: Bucket; label: string }[] = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "later", label: "Later" },
];

function bucketOf(row: ComingDueRow, weekEnd: string): Bucket {
  if (row.daysOut < 0) return "overdue";
  if (row.daysOut === 0) return "today";
  if (row.scheduled <= weekEnd) return "week";
  return "later";
}

function kindLabel(row: ComingDueRow): string {
  if (row.kind === "tlc") return "TLC";
  if (row.kind === "pm") return "PM";
  if (row.kind === "install") return "Install";
  return "Service";
}

export function ComingDuePanel({
  rows,
  counts,
  weekEnd,
  compact,
}: {
  rows: ComingDueRow[];
  counts?: ComingDueCounts;
  weekEnd: string;
  compact?: boolean;
}) {
  const grouped = useMemo(() => {
    const map: Record<Bucket, ComingDueRow[]> = { overdue: [], today: [], week: [], later: [] };
    for (const r of rows) map[bucketOf(r, weekEnd)].push(r);
    return map;
  }, [rows, weekEnd]);
  const [open, setOpen] = useState<Bucket | null>(null);
  const overdue = counts?.overdue ?? grouped.overdue.length;
  const today = counts?.today ?? grouped.today.length;
  const week = counts?.thisWeek ?? grouped.week.length;

  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="font-display text-xl leading-tight">Coming due</h2>
          <p className="text-[11px] text-muted-foreground">Click a row to open the ticket or install.</p>
        </div>
        <ul className="flex flex-wrap gap-1.5 text-[11px]">
          <CountChip label="Overdue" n={overdue} tone="danger" />
          <CountChip label="Today" n={today} tone="warn" />
          <CountChip label="This week" n={week} />
        </ul>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing overdue or coming due.</p>
      ) : (
        <div className={cn("mt-3 space-y-2", compact && "space-y-1.5")}>
          {BUCKETS.map((b) => {
            const list = grouped[b.id];
            if (!list.length) return null;
            const expanded = open === b.id || b.id !== "later" || list.length <= 6;
            return (
              <section key={b.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline justify-between gap-2 text-left"
                  onClick={() => setOpen(open === b.id ? null : b.id)}
                >
                  <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                    {b.label}
                  </span>
                  <span className="tabular text-[11px] text-muted-foreground">{list.length}</span>
                </button>
                {expanded ? (
                  <ul className="mt-1 divide-y divide-border rounded-md border border-border/70">
                    {list.map((row) => (
                      <li key={`${row.entityType}-${row.id}`}>
                        <OpenLink
                          entityType={row.entityType}
                          id={row.id}
                          title={`${row.customer} · ${kindLabel(row)} · ${formatShortDate(row.scheduled)} · ${row.status}${row.wo ? ` · ${row.wo}` : ""}${row.technician || row.accountRep ? ` · ${row.technician || row.accountRep}` : ""}`}
                          className="desk-lift grid gap-0.5 px-2.5 py-1.5 hover:bg-muted/60 sm:grid-cols-[minmax(0,1.4fr)_4.5rem_7.5rem_minmax(0,9rem)] sm:items-center sm:gap-2"
                        >
                          <span className="min-w-0">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate font-medium">{row.customer}</span>
                              <AkBadge on={row.aviKatz} />
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {row.wo || row.detail || row.equipment || "—"}
                            </span>
                            {row.kind === "install" && row.inspectionStatus ? (
                              <span className="block truncate text-[11px] text-muted-foreground">
                                Pre-inspection {row.inspectionStatus}
                                {row.failedItems ? ` · ${row.failedItems}` : ""}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {kindLabel(row)}
                            <span className="mt-0.5 block tabular">{formatShortDate(row.scheduled)}</span>
                          </span>
                          <StatusBadge status={row.status} />
                          <span className="min-w-0 truncate text-[11px] text-muted-foreground">
                            {row.technician || (row.accountRep ? row.accountRep.split(" ")[0] : "unassigned")}
                            <NoRepFlag show={row.noRep} className="ml-1" />
                          </span>
                        </OpenLink>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11px] text-muted-foreground">Tap to show {list.length} later jobs.</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CountChip({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone?: "danger" | "warn";
}) {
  return (
    <li
      className={cn(
        "rounded-full bg-secondary px-2 py-0.5 tabular",
        tone === "danger" && n > 0 && "bg-destructive/12 text-destructive",
        tone === "warn" && n > 0 && "bg-warning/12 text-warning",
      )}
    >
      {label} {n}
    </li>
  );
}
