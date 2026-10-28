import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { exportPartUsage, getPartUsageReport, type UsageReportPage } from "@/lib/ops/part-usage-api";
import {
  USAGE_GROUPS,
  USAGE_GROUP_LABEL,
  USAGE_PERIODS,
  USAGE_PERIOD_LABEL,
  USAGE_SORTS,
  USAGE_SORT_LABEL,
  USAGE_TYPES,
  USAGE_TYPE_LABEL,
  piecesText,
  ticketsAndPieces,
  usageDay,
  type UsageGroup,
  type UsagePeriod,
  type UsageSort,
  type UsageType,
} from "@/lib/ops/part-usage";
import { Button } from "@/components/ui/button";
import { ChartCard, StatCard, StatRow } from "./desk-charts";
import { downloadBase64 } from "./export-dialog";
import { ListToolbar, ToolbarNote, ToolbarSearch, ToolbarSelect } from "./list-toolbar";
import { UsageBars, UsageSpark } from "./part-usage";

/** On screen, the newest periods only; the Excel file has every one. */
const MAX_COLUMNS = 12;

type Row = UsageReportPage["rows"][number];

/**
 * Parts → Usage report (Chuy, 10/28): every part on the list that tickets used, ranked, with filters for the period,
 * the ticket type and the class; counts by month, quarter or year; and the same as an Excel file.
 */
export function PartUsageReport({ classes, onOpen }: { classes: string[]; onOpen: (id: number) => void }) {
  const [period, setPeriod] = useState<UsagePeriod>("12m");
  const [type, setType] = useState<UsageType | "">("");
  const [group, setGroup] = useState<UsageGroup>("month");
  const [sort, setSort] = useState<UsageSort>("tickets");
  const [itemClass, setItemClass] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const [extra, setExtra] = useState<Row[]>([]);
  const filters = { period, types: type ? [type] : undefined, group, sort, itemClass: itemClass || undefined, q: term || undefined };

  const restart = () => {
    setOffset(0);
    setExtra([]);
  };
  useEffect(() => {
    const t = setTimeout(() => {
      setTerm(q.trim());
      setOffset(0);
      setExtra([]);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const report = useQuery({
    queryKey: ["part-usage-report", period, type, group, sort, itemClass, term, offset],
    queryFn: () => getPartUsageReport({ data: { ...filters, offset } }),
    staleTime: 60_000,
  });
  const data = report.data;
  const rows = offset === 0 ? (data?.rows ?? []) : [...extra, ...(data?.rows ?? [])];
  const buckets = data?.buckets ?? [];
  const cols = buckets.slice(-MAX_COLUMNS);
  const colLabels = cols.map((b) => b.label);
  const cut = buckets.length - cols.length;

  const download = useMutation({
    mutationFn: () => exportPartUsage({ data: filters }),
    onSuccess: (file) => {
      downloadBase64(file.filename, file.mime, file.base64);
      toast.success(`Downloaded ${file.rows.toLocaleString("en-US")} part${file.rows === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not make the Excel file"),
  });

  const pick = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    restart();
  };
  const what = [USAGE_PERIOD_LABEL[period], type ? USAGE_TYPE_LABEL[type] : "all tickets", itemClass || null].filter(Boolean).join(" · ");

  return (
    <div data-testid="parts-usage-report">
      <ListToolbar>
        <ToolbarSearch value={q} onChange={setQ} placeholder="Search part number or name…" label="Search the report" testId="usage-search" />
        <ToolbarSelect value={period} onChange={(e) => pick(setPeriod)(e.target.value as UsagePeriod)} aria-label="Period" data-testid="usage-period">
          {USAGE_PERIODS.map((p) => (
            <option key={p} value={p}>
              {USAGE_PERIOD_LABEL[p]}
            </option>
          ))}
        </ToolbarSelect>
        <ToolbarSelect value={type} onChange={(e) => pick(setType)(e.target.value as UsageType | "")} aria-label="Ticket type" allowEmpty emptyLabel="All tickets" data-testid="usage-type">
          {USAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {USAGE_TYPE_LABEL[t]}
            </option>
          ))}
        </ToolbarSelect>
        <ToolbarSelect value={group} onChange={(e) => pick(setGroup)(e.target.value as UsageGroup)} aria-label="Count by" data-testid="usage-group">
          {USAGE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {USAGE_GROUP_LABEL[g]}
            </option>
          ))}
        </ToolbarSelect>
        <ToolbarSelect value={sort} onChange={(e) => pick(setSort)(e.target.value as UsageSort)} aria-label="Sort" data-testid="usage-sort">
          {USAGE_SORTS.map((s) => (
            <option key={s} value={s}>
              {USAGE_SORT_LABEL[s]}
            </option>
          ))}
        </ToolbarSelect>
        {classes.length ? (
          <ToolbarSelect value={itemClass} onChange={(e) => pick(setItemClass)(e.target.value)} aria-label="Class" allowEmpty emptyLabel="All classes" data-testid="usage-class">
            {classes.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </ToolbarSelect>
        ) : null}
        <Button type="button" size="sm" variant="outline" className="h-9 rounded-full" disabled={download.isPending || !data?.total} onClick={() => download.mutate()} data-testid="usage-download">
          <FileSpreadsheet className="size-4" />
          {download.isPending ? "Making the file…" : "Download Excel"}
        </Button>
        <ToolbarNote data-testid="usage-count">{report.isLoading ? "Counting…" : `${(data?.total ?? 0).toLocaleString("en-US")} parts used · ${what}`}</ToolbarNote>
      </ListToolbar>

      <StatRow loaded={report.isSuccess}>
        <StatCard label="Parts used" value={(data?.stats.parts ?? 0).toLocaleString("en-US")} hint="On the list, not hidden" />
        <StatCard label="Tickets with parts" value={(data?.stats.tickets ?? 0).toLocaleString("en-US")} hint="A ticket with three parts counts once" />
        <StatCard label="Pieces used" value={piecesText(data?.stats.pieces ?? 0)} />
      </StatRow>

      {buckets.length ? (
        <div className="mt-4">
          <ChartCard title="Tickets with parts" lede={`${USAGE_GROUP_LABEL[group]} · ${what}. Each row: tickets, then pieces.`}>
            <UsageBars buckets={buckets} testId="usage-trend" />
          </ChartCard>
        </div>
      ) : null}

      {/* A computer: a table with each period's tickets. A phone: one card per part with the period bars. */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card max-sm:hidden" data-testid="usage-table">
        <table className="w-full min-w-[40rem] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] tracking-wide text-muted-foreground uppercase">
              <th className="w-10 px-3 py-2 font-medium">#</th>
              <th className="min-w-[13rem] px-3 py-2 font-medium">Part</th>
              <th className="px-3 py-2 text-right font-medium">Tickets</th>
              <th className="px-3 py-2 text-right font-medium">Pieces</th>
              <th className="px-3 py-2 font-medium whitespace-nowrap">Last used</th>
              {cols.map((b) => (
                <th key={b.key} className="w-10 px-1 py-2 text-right font-medium whitespace-nowrap" title={b.label}>
                  {shortBucket(b.label, group)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => (
              <tr key={r.partId} className="cursor-pointer hover:bg-muted/60" onClick={() => onOpen(r.partId)} data-testid="usage-row" data-sku={r.part?.sku}>
                <td className="px-3 py-2 align-top text-xs tabular text-muted-foreground">{i + 1}</td>
                <td className="min-w-[13rem] px-3 py-2">
                  <PartCell row={r} />
                </td>
                <td className="px-3 py-2 text-right font-medium tabular">{r.tickets.toLocaleString("en-US")}</td>
                <td className="px-3 py-2 text-right tabular">{piecesText(r.pieces)}</td>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted-foreground">{usageDay(r.lastUsed)}</td>
                {r.byBucket.slice(buckets.length - cols.length).map((n, j) => (
                  <td key={cols[j]?.key ?? j} className={`w-10 px-1 py-2 text-right text-xs tabular ${n ? "" : "text-muted-foreground/50"}`}>
                    {n || "·"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card sm:hidden" data-testid="usage-cards">
        {rows.map((r, i) => (
          <li key={r.partId}>
            <button type="button" className="flex w-full items-start gap-3 p-3 text-left" onClick={() => onOpen(r.partId)} data-testid="usage-card">
              <span className="w-6 shrink-0 pt-0.5 text-xs tabular text-muted-foreground">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <PartCell row={r} />
                <span className="mt-1 block text-xs">
                  <span className="font-medium">{ticketsAndPieces(r.tickets, r.pieces)}</span>
                  <span className="text-muted-foreground"> · last {usageDay(r.lastUsed)}</span>
                </span>
                {cols.length > 1 ? (
                  <span className="mt-1.5 block">
                    <UsageSpark counts={r.byBucket.slice(buckets.length - cols.length)} labels={colLabels} />
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {!rows.length && !report.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground" data-testid="usage-empty">
          {report.isError
            ? report.error instanceof Error
              ? report.error.message
              : "The usage report didn't load."
            : "No part on the list was used on a ticket in this period."}
        </p>
      ) : null}
      {cut > 0 && rows.length ? (
        <p className="mt-2 text-xs text-muted-foreground max-sm:hidden">
          The table shows the newest {cols.length} {group === "month" ? "months" : group === "quarter" ? "quarters" : "years"}; the Excel file has all {buckets.length}.
        </p>
      ) : null}
      {data && rows.length < data.total ? (
        <div className="mt-3 flex justify-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={report.isFetching}
            onClick={() => {
              setExtra(rows);
              setOffset(rows.length);
            }}
            data-testid="usage-more"
          >
            Show More
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/** "Oct 26" for a month, "Q4 26" for a quarter: a narrow column head. */
function shortBucket(label: string, group: UsageGroup): string {
  if (group === "year") return label;
  const [a, y] = label.split(" ");
  return `${a} ${String(y).slice(-2)}`;
}

/** The part's name, then its part number and class. A click on the row opens the part's window. */
function PartCell({ row }: { row: Row }) {
  const p = row.part;
  const name = p?.description || p?.item || `Part #${row.partId}`;
  return (
    <span className="block min-w-0">
      <span className="block font-medium break-words">{name}</span>
      <span className="block text-xs text-muted-foreground">
        Part # {p?.mpn || p?.sku || "not set"}
        {p?.itemClass ? ` · ${p.itemClass}` : ""}
      </span>
    </span>
  );
}
