import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { getPartUsage } from "@/lib/ops/part-usage-api";
import {
  USAGE_GROUPS,
  USAGE_GROUP_LABEL,
  USAGE_PERIODS,
  USAGE_PERIOD_LABEL,
  USAGE_SOURCE_LABEL,
  USAGE_TYPES,
  USAGE_TYPE_LABEL,
  bucketKeys,
  piecesText,
  ticketsAndPieces,
  usageBuckets,
  usageDay,
  usageRange,
  usageTotals,
  type PartUse,
  type UsageBucket,
  type UsageGroup,
  type UsagePeriod,
  type UsageTotals,
  type UsageType,
} from "@/lib/ops/part-usage";
import { todayChicago } from "@/lib/ops/clock";
import { fromFor } from "@/lib/ops/search-params";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SelectField } from "@/components/ui/select-field";
import { Skeleton } from "@/components/ui/separator";
import { WoHistoryWindow } from "./wo-history-window";

const heading = "text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase";

const TYPE_TONE: Record<UsageType, string> = {
  service: "bg-ink/10 text-ink dark:bg-cream/12 dark:text-cream",
  tlc: "bg-warning/15 text-warning",
  pm: "bg-secondary text-foreground",
  install: "bg-primary/15 text-primary",
  rebuild: "bg-secondary text-foreground",
  deal: "bg-secondary text-foreground",
  quickbooks: "bg-muted text-muted-foreground",
  corrigo: "bg-muted text-muted-foreground",
  netsuite: "bg-muted text-muted-foreground",
};

export function UsageTypeBadge({ type }: { type: UsageType }) {
  return (
    <span className={cn("inline-block shrink-0 rounded px-1.5 py-px text-[10px] font-medium tracking-wide uppercase", TYPE_TONE[type])}>
      {USAGE_TYPE_LABEL[type]}
    </span>
  );
}

/** Where a use on a KatzDesk ticket was read from, when that's a Corrigo or NetSuite WO part line. */
export function UsageSourceTag({ use }: { use: Pick<PartUse, "type" | "source"> }) {
  if ((use.source !== "corrigo" && use.source !== "netsuite") || use.type === use.source) return null;
  return (
    <span className="inline-block shrink-0 rounded border border-border px-1.5 py-px text-[10px] font-medium tracking-wide text-muted-foreground uppercase" data-testid="usage-source">
      {USAGE_SOURCE_LABEL[use.source]}
    </span>
  );
}

/**
 * Tickets per period as bars, newest first, each with its tickets and pieces: a table and a chart in one. A period
 * with none keeps its row, so a gap shows.
 */
export function UsageBars({ buckets, testId = "usage-bars" }: { buckets: UsageBucket[]; testId?: string }) {
  const max = Math.max(1, ...buckets.map((b) => b.tickets));
  return (
    <ul className="space-y-1.5" data-testid={testId}>
      {[...buckets].reverse().map((b) => (
        <li key={b.key} className="grid grid-cols-[4.75rem_minmax(0,1fr)_9rem] items-center gap-2 text-xs" data-testid="usage-bar" data-key={b.key}>
          <span className="truncate text-muted-foreground tabular">{b.label}</span>
          <span className="h-2.5 min-w-0 overflow-hidden rounded-full bg-secondary">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${b.tickets ? Math.max(3, (b.tickets / max) * 100) : 0}%` }} />
          </span>
          <span className={cn("text-right tabular", b.tickets ? "font-medium" : "text-muted-foreground")}>
            {b.tickets ? ticketsAndPieces(b.tickets, b.pieces) : "None"}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Small bars for a row of the report: tickets in each period, oldest first. */
export function UsageSpark({ counts, labels }: { counts: number[]; labels: string[] }) {
  const max = Math.max(1, ...counts);
  return (
    <span className="flex h-6 items-end gap-px" aria-hidden>
      {counts.map((n, i) => (
        <span
          key={i}
          className={cn("w-1.5 rounded-t-sm", n ? "bg-primary" : "bg-secondary")}
          style={{ height: `${n ? Math.max(15, (n / max) * 100) : 12}%` }}
          title={`${labels[i]}: ${n}`}
        />
      ))}
    </span>
  );
}

/** The line on a part in the list: "Used on 14 tickets · 22 pcs · last Oct 12, 2026", all time. */
export function PartUsageLine({ totals, loading }: { totals: UsageTotals | undefined; loading: boolean }) {
  return (
    <span className="text-muted-foreground" data-testid="part-usage">
      <span className="font-medium tracking-wide uppercase">Used</span>{" "}
      {totals === undefined ? (
        // Not read yet, or the read failed: never "not used" when it isn't known.
        loading ? "…" : "—"
      ) : totals.tickets ? (
        <>
          <span className="text-foreground">{ticketsAndPieces(totals.tickets, totals.pieces)}</span>
          {totals.lastUsed ? ` · last ${usageDay(totals.lastUsed)}` : ""}
        </>
      ) : (
        "Not on a ticket yet"
      )}
    </span>
  );
}

const ROUTE = {
  service: "/service",
  tlc: "/tlc",
  pm: "/pms",
  install: "/installs",
  rebuild: "/rebuilds",
  deal: "/pipeline",
} as const satisfies Record<Exclude<UsageType, "quickbooks" | "corrigo" | "netsuite">, string>;

/** A WO part line on no KatzDesk ticket: nothing to open. */
const onNoTicket = (u: PartUse) => u.type === "corrigo" || u.type === "netsuite";

/** Month for up to about a year of use, then quarters, then years, so the list stays short. */
function defaultGroup(uses: PartUse[], range: { from: string | null; to: string | null }): UsageGroup {
  const days = uses.map((u) => u.usedOn).filter((d): d is string => !!d).sort();
  const from = range.from ?? days[0];
  const to = range.to ?? days[days.length - 1];
  if (!from || !to) return "month";
  if (bucketKeys(from, to, "month").length <= 13) return "month";
  return bucketKeys(from, to, "quarter").length <= 12 ? "quarter" : "year";
}

const inRange = (day: string | null, r: { from: string | null; to: string | null }) =>
  !r.from && !r.to ? true : !!day && (!r.from || day >= r.from) && (!r.to || day <= r.to);

const FIRST = 20;

/**
 * The part window's Usage: every ticket that used the part (KatzDesk, the QuickBooks history and WO part lines from
 * Corrigo and NetSuite), with its totals and a count by month, quarter or year. A ticket opens on its own page; a
 * QuickBooks work order opens in its window. A WO part line shows its source; one on no ticket has nothing to open.
 */
export function PartUsageSection({ partId }: { partId: number }) {
  const q = useQuery({ queryKey: ["part-usage", partId], queryFn: () => getPartUsage({ data: { id: partId } }), staleTime: 60_000 });
  const navigate = useNavigate();
  const here = useLocation();
  const [period, setPeriod] = useState<UsagePeriod>("all");
  const [type, setType] = useState<UsageType | "">("");
  const [group, setGroup] = useState<UsageGroup | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [history, setHistory] = useState<number | null>(null);
  const all = q.data?.uses ?? [];
  const range = usageRange(period, todayChicago());
  const uses = all.filter((u) => (!type || u.type === type) && inRange(u.usedOn, range));
  const totals = usageTotals(uses);
  const by = group ?? defaultGroup(uses, range);
  const buckets = usageBuckets(uses, by, range);
  const types = USAGE_TYPES.filter((t) => all.some((u) => u.type === t));
  const shown = showAll ? uses : uses.slice(0, FIRST);

  const open = (u: PartUse) => {
    if (u.type === "quickbooks") {
      setHistory(u.historyId ?? u.refId);
      return;
    }
    if (u.type === "corrigo" || u.type === "netsuite") return;
    const to = ROUTE[u.type];
    void navigate({ to, search: { open: u.refId, from: fromFor(here, to) } });
  };

  return (
    <section className="border-t border-border p-5" data-testid="part-window-usage">
      <h3 className={heading}>Usage</h3>
      {q.isLoading ? (
        <Skeleton className="mt-3 h-24 w-full" />
      ) : q.isError ? (
        <p className="mt-3 text-sm text-destructive">{q.error instanceof Error ? q.error.message : "Could not load the usage."}</p>
      ) : !all.length ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="part-usage-none">
          Not on a ticket yet. Tickets, PM and install invoices, parts logged on PMs, the QuickBooks history and WO part lines from Corrigo and NetSuite all count.
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            <SelectField value={period} onChange={(e) => setPeriod(e.target.value as UsagePeriod)} aria-label="Period" className="h-9 w-auto" data-testid="part-usage-period">
              {USAGE_PERIODS.map((p) => (
                <option key={p} value={p}>
                  {USAGE_PERIOD_LABEL[p]}
                </option>
              ))}
            </SelectField>
            {types.length > 1 ? (
              <SelectField
                value={type}
                onChange={(e) => setType(e.target.value as UsageType | "")}
                aria-label="Ticket type"
                className="h-9 w-auto"
                allowEmpty
                emptyLabel="All tickets"
                data-testid="part-usage-type"
              >
                {types.map((t) => (
                  <option key={t} value={t}>
                    {USAGE_TYPE_LABEL[t]}
                  </option>
                ))}
              </SelectField>
            ) : null}
            <SelectField value={by} onChange={(e) => setGroup(e.target.value as UsageGroup)} aria-label="Count by" className="h-9 w-auto" data-testid="part-usage-group">
              {USAGE_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {USAGE_GROUP_LABEL[g]}
                </option>
              ))}
            </SelectField>
          </div>
          <p className="mt-3 text-sm" data-testid="part-usage-totals">
            {totals.tickets ? (
              <>
                <span className="font-medium">{ticketsAndPieces(totals.tickets, totals.pieces)}</span>
                <span className="text-muted-foreground">
                  {totals.firstUsed ? ` · first ${usageDay(totals.firstUsed)}` : ""}
                  {totals.lastUsed ? ` · last ${usageDay(totals.lastUsed)}` : ""}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">None in this period.</span>
            )}
          </p>
          {totals.tickets && buckets.length ? (
            <div className="mt-3">
              <UsageBars buckets={buckets} testId="part-usage-bars" />
            </div>
          ) : null}
          {shown.length ? (
            <ul className="mt-4 divide-y divide-border rounded-lg border border-border" data-testid="part-usage-tickets">
              {shown.map((u) => {
                const body = (
                  <>
                    <span className="w-[5.5rem] shrink-0 text-xs tabular text-muted-foreground">{usageDay(u.usedOn)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                        <UsageTypeBadge type={u.type} />
                        <UsageSourceTag use={u} />
                        <span className="min-w-0 break-words font-medium">
                          {u.label || (u.type === "quickbooks" ? "QuickBooks work order" : onNoTicket(u) ? "Work order" : `#${u.refId}`)}
                        </span>
                      </span>
                      {u.customer ? (
                        <span className="block truncate text-xs text-muted-foreground">{u.customer}</span>
                      ) : onNoTicket(u) ? (
                        <span className="block text-xs text-muted-foreground">No KatzDesk ticket with this WO</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs tabular">
                      {piecesText(u.pieces)} pc{u.pieces === 1 ? "" : "s"}
                    </span>
                  </>
                );
                const row = "flex w-full items-start gap-2 px-3 py-2 text-left text-sm";
                return (
                  <li key={u.ticketKey}>
                    {onNoTicket(u) ? (
                      <div className={row} data-testid="part-usage-ticket" data-type={u.type} data-source={u.source}>
                        {body}
                      </div>
                    ) : (
                      <button type="button" className={cn(row, "hover:bg-muted/60")} onClick={() => open(u)} data-testid="part-usage-ticket" data-type={u.type} data-source={u.source}>
                        {body}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : null}
          {uses.length > shown.length ? (
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => setShowAll(true)} data-testid="part-usage-all">
              Show all {uses.length.toLocaleString("en-US")}
            </Button>
          ) : null}
        </>
      )}
      {history != null ? <WoHistoryWindow id={history} initialTab="invoice" onClose={() => setHistory(null)} /> : null}
    </section>
  );
}
