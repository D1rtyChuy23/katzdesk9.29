import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, FileType } from "lucide-react";
import { toast } from "sonner";
import { downloadAnalytics, getAnalytics } from "@/lib/ops/analytics-api";
import { downloadPartsProfit, getPartsProfit } from "@/lib/ops/parts-profit-api";
import { downloadProfitReport, getCostVisibility, getProfitReport } from "@/lib/ops/profit-report-api";
import { HISTORY_SECTION_TITLE, jobTypeLabel, type GroupTotals, type HistorySection, type HistoryTotals } from "@/lib/ops/profit-report";
import { ANALYTICS_LABEL, ANALYTICS_TYPES, NO_REP, type AnalyticsFilters, type AnalyticsRow, type AnalyticsType, type ExportFormat } from "@/lib/ops/analytics";
import { addDays, todayChicago } from "@/lib/ops/clock";
import { formatRep } from "@/lib/ops/rep-match";
import { ActionButton, ActionMenu, ChartCard, FilterChip, SimpleBars, StatCard, StatRow } from "@/components/desk/desk-charts";
import { downloadBase64 } from "@/components/desk/export-dialog";
import { StatusBadge } from "@/components/desk/flag-badge";
import { ListToolbar, ToolbarNote, ToolbarSearch, ToolbarSelect } from "@/components/desk/list-toolbar";
import { OpenLink } from "@/components/desk/open-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/separator";
import { notLoadedText } from "@/lib/ops/load-problem";

export const Route = createFileRoute("/_app/analytics")({ component: Page });

type RangeId = "month" | "90" | "year" | "all" | "custom";

const RANGES: { id: Exclude<RangeId, "custom">; label: string }[] = [
  { id: "month", label: "This Month" },
  { id: "90", label: "Last 90 Days" },
  { id: "year", label: "This Year" },
  { id: "all", label: "All Dates" },
];

function rangeDates(id: Exclude<RangeId, "custom">, today: string): { from: string; to: string } {
  const [y, m] = today.split("-");
  if (id === "month") return { from: `${y}-${m}-01`, to: addDays(`${Number(m) === 12 ? Number(y) + 1 : y}-${String((Number(m) % 12) + 1).padStart(2, "0")}-01`, -1) };
  if (id === "90") return { from: addDays(today, -90), to: today };
  if (id === "year") return { from: `${y}-01-01`, to: `${y}-12-31` };
  return { from: "", to: "" };
}

/** The page each kind of record opens on. */
const OPEN_AS: Record<AnalyticsType, string> = { installs: "install", service: "service", pms: "pm", tlc: "tlc", rebuilds: "rebuild" };

const PAGE = 100;

/*
 * Phones (below sm): the wide tables become one card per row. Same table, same rows and test ids; CSS only
 * (display, order and a label before each value). sm and up keep the table exactly as it was.
 */
const CARD_TABLE = "max-sm:block";
const CARD_HEAD = "max-sm:hidden";
const CARD_BODY = "max-sm:block";
const CARD_ROW = "max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-3 max-sm:gap-y-1 max-sm:px-4 max-sm:py-3";
/** A full-width line of the card. */
const CARD_LINE = "max-sm:basis-full max-sm:max-w-none max-sm:p-0";
/** A small value in a run of values; the label comes from before:content on the cell. */
const CARD_VALUE = "max-sm:p-0 max-sm:text-left max-sm:text-xs max-sm:before:mr-1 max-sm:before:font-normal max-sm:before:text-muted-foreground";

type ReportView = "records" | "profit-all" | "profit";

function Page() {
  // Profit and Parts Profit show cost and margin: for an Admin, or a role ticked in Who Sees Cost and Margin (11/20).
  const cost = useQuery({ queryKey: ["cost-visibility"], queryFn: () => getCostVisibility() });
  // Never Warehouse, which doesn't read customers' billing.
  const showCost = !!cost.data?.showReports;
  const [view, setView] = useState<ReportView>("records");
  const switcher = showCost ? (
    <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Report" data-testid="analytics-report-switch">
      <FilterChip selected={view === "records"} onClick={() => setView("records")} data-testid="analytics-view-records">
        Records
      </FilterChip>
      <FilterChip selected={view === "profit-all"} onClick={() => setView("profit-all")} data-testid="analytics-view-profit-all">
        Profit
      </FilterChip>
      <FilterChip selected={view === "profit"} onClick={() => setView("profit")} data-testid="analytics-view-profit">
        Parts Profit
      </FilterChip>
    </div>
  ) : null;
  if (showCost && view === "profit-all") return <ProfitView switcher={switcher} />;
  return view === "profit" && showCost ? <PartsProfitView switcher={switcher} /> : <RecordsView switcher={switcher} />;
}

function RecordsView({ switcher }: { switcher: ReactNode }) {
  const today = todayChicago();
  const [range, setRange] = useState<RangeId>("year");
  const [dates, setDates] = useState(() => rangeDates("year", today));
  const [types, setTypes] = useState<AnalyticsType[]>([]);
  const [rep, setRep] = useState("");
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [shown, setShown] = useState(PAGE);
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  // One set of filters feeds the page and every export, so a file always holds what is on screen.
  const filters: AnalyticsFilters = { from: dates.from || null, to: dates.to || null, types: types.length ? types : null, rep: rep || null, q: term || null };
  const view = useQuery({
    queryKey: ["analytics", filters],
    queryFn: () => getAnalytics({ data: filters }),
    placeholderData: keepPreviousData,
  });
  useEffect(() => setShown(PAGE), [dates.from, dates.to, types, rep, term]);

  const file = useMutation({
    mutationFn: (format: ExportFormat) => downloadAnalytics({ data: { filters, format } }),
    onSuccess: (f) => {
      downloadBase64(f.filename, f.mime, f.base64);
      toast.success(`${f.filename} · ${f.records} record${f.records === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build the file"),
  });
  const building = (format: ExportFormat) => file.isPending && file.variables === format;

  const data = view.data;
  const rows = data?.rows ?? [];
  const toggleType = (t: AnalyticsType) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : ANALYTICS_TYPES.filter((x) => x === t || cur.includes(x))));

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Analytics</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Installs, service, PMs, TLC and rebuilds in one list, with account, date, status and rep. An export holds the same records shown here.
          </p>
          {switcher}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ActionMenu label="Export" testId="analytics-export">
            <ActionButton icon={FileText} busy={building("pdf")} busyLabel="Building…" onClick={() => file.mutate("pdf")} data-testid="analytics-export-pdf">
              PDF
            </ActionButton>
            <ActionButton icon={FileSpreadsheet} busy={building("xlsx")} busyLabel="Building…" onClick={() => file.mutate("xlsx")} data-testid="analytics-export-xlsx">
              Excel
            </ActionButton>
            <ActionButton icon={FileType} busy={building("docx")} busyLabel="Building…" onClick={() => file.mutate("docx")} data-testid="analytics-export-docx">
              Word
            </ActionButton>
          </ActionMenu>
        </div>
      </header>

      <StatRow loaded={view.isSuccess}>
        {(data?.summary ?? ANALYTICS_TYPES.map((type) => ({ type, label: ANALYTICS_LABEL[type], total: 0, statuses: [] }))).map((s) => (
          <StatCard
            key={s.type}
            label={s.label}
            value={view.isLoading ? "…" : s.total}
            hint={s.statuses.slice(0, 3).map((x) => `${x.status} ${x.count}`).join(" · ") || "None in this range"}
            selected={types.includes(s.type)}
            onClick={() => toggleType(s.type)}
          />
        ))}
      </StatRow>

      <ListToolbar data-testid="analytics-toolbar">
        <ToolbarSearch value={q} onChange={setQ} placeholder="Search records…" label="Search account, status, rep, tech or reference" testId="analytics-search" />
        {RANGES.map((r) => (
          <FilterChip
            key={r.id}
            selected={range === r.id}
            onClick={() => {
              setRange(r.id);
              setDates(rangeDates(r.id, today));
            }}
            data-testid={`analytics-range-${r.id}`}
          >
            {r.label}
          </FilterChip>
        ))}
        {/* From and To stay side by side, so the range never splits across two lines. Phones: tighter boxes (To keeps
            room for the six-digit year Chrome reserves when there is no max), and the pair wraps on the narrowest screens
            rather than running off the edge. */}
        <span className="flex shrink-0 items-center gap-2 max-sm:max-w-full max-sm:flex-wrap">
        <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          From
          <Input
            type="date"
            value={dates.from}
            max={dates.to || undefined}
            onChange={(e) => {
              setRange("custom");
              setDates((d) => ({ ...d, from: e.target.value }));
            }}
            className="h-9 w-[8.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem] pointer-coarse:w-auto"
            aria-label="From date"
            data-testid="analytics-from"
          />
        </label>
        <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          To
          <Input
            type="date"
            value={dates.to}
            min={dates.from || undefined}
            onChange={(e) => {
              setRange("custom");
              setDates((d) => ({ ...d, to: e.target.value }));
            }}
            className="h-9 w-[9.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem] pointer-coarse:w-auto"
            aria-label="To date"
            data-testid="analytics-to"
          />
        </label>
        </span>
        <ToolbarSelect value={rep} onChange={(e) => setRep(e.target.value)} allowEmpty emptyLabel="All reps" aria-label="Filter by rep" className="w-44" data-testid="analytics-rep">
          <option value={NO_REP}>No rep assigned</option>
          {(data?.repOptions ?? []).map((r) => (
            <option key={r} value={r}>
              {formatRep(r) || r}
            </option>
          ))}
        </ToolbarSelect>
        <ToolbarNote data-testid="analytics-count">
          {rows.length} record{rows.length === 1 ? "" : "s"}
        </ToolbarNote>
      </ListToolbar>
      {data ? (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="analytics-scope">
          {data.scope}
        </p>
      ) : null}

      <section className="mt-4 grid min-w-0 gap-4 lg:grid-cols-2">
        <ChartCard title="By Month" lede="Records by the date each one carries: installed, completed, scheduled or received.">
          {data?.months.length ? (
            <SimpleBars data={data.months.slice(-12).map((m) => ({ month: m.label, count: m.total }))} xKey="month" yKey="count" yLabel="Records" />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing in this range.</p>
          )}
        </ChartCard>
        <ChartCard title="By Rep" lede="The rep on the record, or the rep saved on the account.">
          {data?.reps.length ? (
            <SimpleBars data={data.reps.slice(0, 8).map((r) => ({ rep: r.rep === "No rep" ? r.rep : formatRep(r.rep) || r.rep, count: r.count }))} xKey="rep" yKey="count" yLabel="Records" horizontal />
          ) : (
            <p className="text-sm text-muted-foreground">Nothing in this range.</p>
          )}
        </ChartCard>
      </section>

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card" data-testid="analytics-records">
        {view.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className={`w-full text-sm sm:min-w-[62rem] ${CARD_TABLE}`}>
              <thead className={`text-left text-xs tracking-wide text-muted-foreground uppercase ${CARD_HEAD}`}>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-2 py-2.5 font-medium">Account</th>
                  <th className="px-2 py-2.5 font-medium">Account #</th>
                  <th className="px-2 py-2.5 font-medium">Date</th>
                  <th className="px-2 py-2.5 font-medium">Status</th>
                  <th className="px-2 py-2.5 font-medium">Rep</th>
                  <th className="px-2 py-2.5 font-medium">Tech / Owner</th>
                  <th className="px-2 py-2.5 font-medium">Reference</th>
                  <th className="px-2 py-2.5 pr-4 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className={CARD_BODY}>
                {rows.slice(0, shown).map((r) => (
                  <RecordRow key={`${r.type}-${r.id}`} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-sm text-muted-foreground">{notLoadedText(view, "analytics") ?? "No records in this range. Widen the dates, or clear a filter."}</p>
        )}
        {rows.length > shown ? (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {shown} of {rows.length}. An export has all {rows.length}.
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => setShown((n) => n + PAGE)} data-testid="analytics-more">
              Show More
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function RecordRow({ row: r }: { row: AnalyticsRow }) {
  return (
    // Phone card: account on top; type, account #, date and status; then rep, tech and reference; then the detail.
    <tr
      className={`border-b border-border align-top last:border-b-0 hover:bg-muted/60 ${CARD_ROW} max-sm:pt-1.5`}
      data-testid="analytics-row"
      data-type={r.type}
    >
      <td className="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-copper uppercase max-sm:p-0">{ANALYTICS_LABEL[r.type]}</td>
      <td className={`px-2 py-2 max-sm:order-first ${CARD_LINE}`}>
        <OpenLink entityType={OPEN_AS[r.type]} id={r.id} className="font-medium hover:underline max-sm:inline-block max-sm:py-2 max-sm:text-base max-sm:leading-snug" title="Open this record">
          {r.account || "No account"}
        </OpenLink>
      </td>
      <td className={`tabular px-2 py-2 whitespace-nowrap ${CARD_VALUE} max-sm:before:content-['Acct']`} data-testid="analytics-account-number">
        {r.accountNumber || <span className="text-muted-foreground">—</span>}
      </td>
      <td className="tabular px-2 py-2 whitespace-nowrap max-sm:p-0 max-sm:text-xs">{r.date || "—"}</td>
      {/* Phones: the cell's box drops out and its ::after takes a full line, so rep / tech / reference start a new line. */}
      <td className="px-2 py-2 max-sm:contents max-sm:after:basis-full max-sm:after:content-['']">
        <StatusBadge status={r.status} tight />
      </td>
      <td className={`px-2 py-2 ${CARD_VALUE} max-sm:before:content-['Rep']`}>{r.rep ? formatRep(r.rep) || r.rep : <span className="text-muted-foreground">No rep</span>}</td>
      <td className={`px-2 py-2 ${CARD_VALUE} max-sm:before:content-['Tech']`}>{r.tech || <span className="text-muted-foreground">—</span>}</td>
      <td className={`tabular px-2 py-2 ${CARD_VALUE} max-sm:before:content-['Ref']`}>{r.ref || <span className="text-muted-foreground">—</span>}</td>
      <td className={`max-w-[18rem] px-2 py-2 pr-4 text-xs text-muted-foreground ${CARD_LINE}`}>
        <span className="line-clamp-2" title={r.detail}>
          {r.detail}
        </span>
      </td>
    </tr>
  );
}

const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/** Parts Profit: invoiced part lines per MPN, with qty, cost, sell, discount and margin. Same three exports. */
function PartsProfitView({ switcher }: { switcher: ReactNode }) {
  const today = todayChicago();
  const [range, setRange] = useState<RangeId>("year");
  const [dates, setDates] = useState(() => rangeDates("year", today));
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [shown, setShown] = useState(PAGE);
  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);
  const filters = { from: dates.from || null, to: dates.to || null, q: term || null };
  const view = useQuery({ queryKey: ["parts-profit", filters], queryFn: () => getPartsProfit({ data: filters }), placeholderData: keepPreviousData });
  const file = useMutation({
    mutationFn: (format: ExportFormat) => downloadPartsProfit({ data: { filters, format } }),
    onSuccess: (f) => {
      downloadBase64(f.filename, f.mime, f.base64);
      toast.success(`${f.filename} · ${f.records} MPN${f.records === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build the file"),
  });
  const building = (format: ExportFormat) => file.isPending && file.variables === format;
  const d = view.data;
  const rows = d?.rows ?? [];
  const t = d?.totals;
  return (
    <div data-testid="parts-profit">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Analytics</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Parts Profit: every part on an invoiced ticket, by MPN. Cost is the NetSuite Purchase Price (or Our Discount Rule when a part has none; lines invoiced before 11/20 keep the cost stored then), and is stored when the
            ticket is invoiced. Margin is sell, less the ticket discount, less cost.
          </p>
          {switcher}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ActionMenu label="Export" testId="profit-export">
            <ActionButton icon={FileText} busy={building("pdf")} busyLabel="Building…" onClick={() => file.mutate("pdf")} data-testid="profit-export-pdf">
              PDF
            </ActionButton>
            <ActionButton icon={FileSpreadsheet} busy={building("xlsx")} busyLabel="Building…" onClick={() => file.mutate("xlsx")} data-testid="profit-export-xlsx">
              Excel
            </ActionButton>
            <ActionButton icon={FileType} busy={building("docx")} busyLabel="Building…" onClick={() => file.mutate("docx")} data-testid="profit-export-docx">
              Word
            </ActionButton>
          </ActionMenu>
        </div>
      </header>

      <StatRow loaded={view.isSuccess}>
        <StatCard label="Sell" value={t ? money(t.sell) : "…"} hint={t ? `${t.qty} invoiced · ${t.lines} line${t.lines === 1 ? "" : "s"}` : ""} />
        <StatCard label="Cost" value={t ? money(t.cost) : "…"} hint={t?.noCost ? `${t.noCost} line${t.noCost === 1 ? "" : "s"} with no cost` : "Every line has a cost"} />
        <StatCard label="Discount" value={t ? money(t.ourDiscount) : "…"} hint={d ? d.rule : ""} />
        <StatCard label="Ticket Discount" value={t ? money(t.ticketDiscount) : "…"} hint="Given to the customer" />
        <StatCard label="Margin" value={t ? money(t.margin) : "…"} hint={t?.marginPct != null ? `${t.marginPct}% of net sell` : "—"} tone={t && t.margin < 0 ? "danger" : undefined} />
      </StatRow>

      <ListToolbar data-testid="profit-toolbar">
        <ToolbarSearch value={q} onChange={setQ} placeholder="Search MPN, SKU or part…" label="Search parts" testId="profit-search" />
        {RANGES.map((r) => (
          <FilterChip
            key={r.id}
            selected={range === r.id}
            onClick={() => {
              setRange(r.id);
              setDates(rangeDates(r.id, today));
            }}
          >
            {r.label}
          </FilterChip>
        ))}
        <span className="flex shrink-0 items-center gap-2 max-sm:max-w-full max-sm:flex-wrap">
          <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            From
            <Input type="date" value={dates.from} max={dates.to || undefined} onChange={(e) => { setRange("custom"); setDates((x) => ({ ...x, from: e.target.value })); }} className="h-9 w-[8.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem] pointer-coarse:w-auto" aria-label="From date" />
          </label>
          <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            To
            <Input type="date" value={dates.to} min={dates.from || undefined} onChange={(e) => { setRange("custom"); setDates((x) => ({ ...x, to: e.target.value })); }} className="h-9 w-[9.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem] pointer-coarse:w-auto" aria-label="To date" />
          </label>
        </span>
        <ToolbarNote>{rows.length} MPN{rows.length === 1 ? "" : "s"}</ToolbarNote>
      </ListToolbar>
      {d ? (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="profit-scope">
          {d.scope}
        </p>
      ) : null}

      <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card" data-testid="profit-records">
        {view.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : rows.length ? (
          <div className="overflow-x-auto">
            <table className={`w-full text-sm sm:min-w-[56rem] ${CARD_TABLE}`}>
              <thead className={`text-left text-xs tracking-wide text-muted-foreground uppercase ${CARD_HEAD}`}>
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-medium">MPN</th>
                  <th className="px-2 py-2.5 font-medium">Part</th>
                  <th className="px-2 py-2.5 text-right font-medium">Qty Invoiced</th>
                  <th className="px-2 py-2.5 text-right font-medium">Cost</th>
                  <th className="px-2 py-2.5 text-right font-medium">Sell</th>
                  <th className="px-2 py-2.5 text-right font-medium">Discount</th>
                  <th className="px-2 py-2.5 text-right font-medium">Ticket Discount</th>
                  <th className="px-2 py-2.5 text-right font-medium">Margin</th>
                  <th className="px-2 py-2.5 pr-4 text-right font-medium">Margin %</th>
                </tr>
              </thead>
              <tbody className={CARD_BODY}>
                {rows.slice(0, shown).map((r) => (
                  // Phone card: MPN, then the part, then the money as labelled values.
                  <tr key={`${r.mpn}-${r.sku}`} className={`border-b border-border align-top last:border-b-0 ${CARD_ROW}`} data-testid="profit-row">
                    <td className={`px-4 py-2 font-medium ${CARD_LINE}`}>{r.mpn}</td>
                    <td className={`max-w-[16rem] px-2 py-2 text-xs text-muted-foreground ${CARD_LINE} max-sm:pb-1`}>
                      <span className="block font-medium text-foreground">{r.sku}</span>
                      <span className="line-clamp-1 max-sm:line-clamp-none">{r.description}</span>
                    </td>
                    <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Qty']`}>{r.qty}</td>
                    <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Cost']`}>
                      {money(r.cost)}
                      {r.noCost ? <span className="block text-[11px] text-warning">{r.noCost} with no cost</span> : null}
                    </td>
                    <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Sell']`}>{money(r.sell)}</td>
                    <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Discount']`}>{money(r.ourDiscount)}</td>
                    <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Ticket_discount']`}>{money(r.ticketDiscount)}</td>
                    <td className={`tabular px-2 py-2 text-right font-medium ${r.margin < 0 ? "text-destructive" : ""} ${CARD_VALUE} max-sm:before:content-['Margin']`}>{money(r.margin)}</td>
                    <td className={`tabular px-2 py-2 pr-4 text-right ${CARD_VALUE} max-sm:before:content-['Margin_%']`}>{r.marginPct == null ? "—" : `${r.marginPct}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-sm text-muted-foreground">{notLoadedText(view, "parts profit") ?? "No parts on invoiced tickets in this range. A ticket counts once its Sales Order number is entered."}</p>
        )}
        {rows.length > shown ? (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
            <span>
              Showing {shown} of {rows.length}. An export has all {rows.length}.
            </span>
            <Button type="button" size="sm" variant="outline" onClick={() => setShown((n) => n + PAGE)}>
              Show More
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}

/**
 * Profit (11/20): every billed job's revenue, cost and margin, by job type and by customer. Margin adds up the bills with
 * every cost known; the rest show as sell with no cost.
 */
function ProfitView({ switcher }: { switcher: ReactNode }) {
  const today = todayChicago();
  const [range, setRange] = useState<RangeId>("year");
  const [dates, setDates] = useState(() => rangeDates("year", today));
  const [shown, setShown] = useState(PAGE);
  const filters = { from: dates.from || null, to: dates.to || null };
  useEffect(() => setShown(PAGE), [dates.from, dates.to]);
  const view = useQuery({ queryKey: ["profit-report", filters], queryFn: () => getProfitReport({ data: filters }), placeholderData: keepPreviousData });
  const file = useMutation({
    mutationFn: (format: ExportFormat) => downloadProfitReport({ data: { filters, format } }),
    onSuccess: (f) => {
      downloadBase64(f.filename, f.mime, f.base64);
      toast.success(`${f.filename} · ${f.records} customer${f.records === 1 ? "" : "s"}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not build the file"),
  });
  const building = (format: ExportFormat) => file.isPending && file.variables === format;
  const d = view.data;
  const t = d?.totals;
  const customers = d?.byCustomer ?? [];
  return (
    <div data-testid="profit-report">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">Analytics</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Profit: every billed ticket, PM, install, rebuild and deal, each counted once. Parts at their Purchase Price (or Our Discount Rule),
            {d?.laborHidden ? " labor not shown," : " labor at the Labor Cost Rate,"} the trip at no cost. Bills before 2026 count as sell with no cost.
          </p>
          {switcher}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ActionMenu label="Export" testId="profit-all-export">
            <ActionButton icon={FileText} busy={building("pdf")} busyLabel="Building…" onClick={() => file.mutate("pdf")}>
              PDF
            </ActionButton>
            <ActionButton icon={FileSpreadsheet} busy={building("xlsx")} busyLabel="Building…" onClick={() => file.mutate("xlsx")}>
              Excel
            </ActionButton>
            <ActionButton icon={FileType} busy={building("docx")} busyLabel="Building…" onClick={() => file.mutate("docx")}>
              Word
            </ActionButton>
          </ActionMenu>
        </div>
      </header>

      <StatRow loaded={view.isSuccess}>
        <StatCard label="Sell" value={t ? money(t.sell) : "…"} hint={t ? `${t.bills} bill${t.bills === 1 ? "" : "s"}` : ""} />
        <StatCard label="Discount" value={t ? money(t.discount) : "…"} hint="Given to the customer" />
        <StatCard label="Cost" value={t ? money(t.cost) : "…"} hint={t?.estimated ? `${t.estimated} estimated` : "Stored when billed"} />
        <StatCard label="Margin" value={t ? money(t.margin) : "…"} hint={t?.marginPct != null ? `${t.marginPct}% of net sell with cost` : "—"} tone={t && t.margin < 0 ? "danger" : undefined} />
        <StatCard label="Sell With No Cost" value={t ? money(t.uncostedSell) : "…"} hint={t?.before2026 ? `${t.before2026} before 2026` : "Not in the margin"} />
      </StatRow>

      <ListToolbar data-testid="profit-all-toolbar">
        {RANGES.map((r) => (
          <FilterChip
            key={r.id}
            selected={range === r.id}
            onClick={() => {
              setRange(r.id);
              setDates(rangeDates(r.id, today));
            }}
          >
            {r.label}
          </FilterChip>
        ))}
        <span className="flex shrink-0 items-center gap-2 max-sm:max-w-full max-sm:flex-wrap">
          <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            From
            <Input type="date" value={dates.from} max={dates.to || undefined} onChange={(e) => { setRange("custom"); setDates((x) => ({ ...x, from: e.target.value })); }} className="h-9 w-[8.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem] pointer-coarse:w-auto" aria-label="From date" />
          </label>
          <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            To
            <Input type="date" value={dates.to} min={dates.from || undefined} onChange={(e) => { setRange("custom"); setDates((x) => ({ ...x, to: e.target.value })); }} className="h-9 w-[9.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem] pointer-coarse:w-auto" aria-label="To date" />
          </label>
        </span>
      </ListToolbar>
      {d ? (
        <p className="mt-2 text-xs text-muted-foreground" data-testid="profit-all-scope">
          {d.scope}
        </p>
      ) : null}

      <div className={view.isPlaceholderData ? "opacity-60 transition-opacity" : "transition-opacity"} aria-busy={view.isPlaceholderData}>
      <ProfitTable title="By Job Type" rows={(d?.byType ?? []).map((g) => ({ ...g, label: jobTypeLabel(g.key) }))} loading={view.isLoading} empty={notLoadedText(view, "profit") ?? "Nothing billed in this range."} testId="profit-by-type" />
      <ProfitTable
        title="By Customer"
        rows={customers.slice(0, shown).map((g) => ({ ...g, label: g.label || "(no customer)" }))}
        loading={view.isLoading}
        empty={notLoadedText(view, "profit") ?? "Nothing billed in this range."}
        testId="profit-by-customer"
        more={customers.length > shown ? { shown, total: customers.length, onMore: () => setShown((n) => n + PAGE) } : null}
      />
      {d ? <HistoryProfit history={d.history} /> : null}
      </div>
    </div>
  );
}

/** QuickBooks history (Jesus, 11/24): its own section, never added into the tables or totals above. */
function HistoryProfit({ history }: { history: HistorySection }) {
  const [shown, setShown] = useState(PAGE);
  const customers = history.byCustomer;
  return (
    <section className="mt-8" data-testid="profit-history">
      <h2 className="font-display text-xl font-medium tracking-tight">{HISTORY_SECTION_TITLE}</h2>
      <p className="mt-1 text-xs text-muted-foreground" data-testid="profit-history-note">
        Work Order History invoices, apart from the bills above. {history.note}.
      </p>
      <HistoryTable title="By Year" first="Year" rows={history.byYear} total={history.totals} testId="profit-history-by-year" />
      <HistoryTable
        title="By Customer"
        first="Customer"
        rows={customers.slice(0, shown)}
        testId="profit-history-by-customer"
        more={customers.length > shown ? { shown, total: customers.length, onMore: () => setShown((n) => n + PAGE) } : null}
      />
    </section>
  );
}

function HistoryTable({
  title,
  first,
  rows,
  total = null,
  testId,
  more = null,
}: {
  title: string;
  first: string;
  rows: (HistoryTotals & { key: string; label: string })[];
  total?: HistoryTotals | null;
  testId: string;
  more?: { shown: number; total: number; onMore: () => void } | null;
}) {
  const row = (r: HistoryTotals & { label: string }, key: string, bold = false) => (
    <tr key={key} className={`border-b border-border align-top last:border-b-0 ${CARD_ROW} ${bold ? "font-medium" : ""}`} data-testid="profit-history-row">
      <td className={`px-4 py-2 font-medium ${CARD_LINE}`}>{r.label || "(no customer)"}</td>
      <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Bills']`}>{r.bills}</td>
      <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Sell']`}>{money(r.sell)}</td>
      <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Discount']`}>{money(r.discount)}</td>
      <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Parts_cost']`}>{money(r.cost)}</td>
      <td className={`tabular px-2 py-2 text-right font-medium ${r.profit < 0 ? "text-destructive" : ""} ${CARD_VALUE} max-sm:before:content-['Profit']`}>{money(r.profit)}</td>
      <td className={`tabular px-2 py-2 pr-4 text-right ${CARD_VALUE} max-sm:before:content-['Uncosted']`}>{money(r.uncostedSell)}</td>
    </tr>
  );
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card" data-testid={testId}>
      <h3 className="border-b border-border px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className={`w-full text-sm sm:min-w-[46rem] ${CARD_TABLE}`}>
            <thead className={`text-left text-xs tracking-wide text-muted-foreground uppercase ${CARD_HEAD}`}>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">{first}</th>
                <th className="px-2 py-2.5 text-right font-medium">Bills</th>
                <th className="px-2 py-2.5 text-right font-medium">Sell</th>
                <th className="px-2 py-2.5 text-right font-medium">Discount</th>
                <th className="px-2 py-2.5 text-right font-medium">Parts Cost</th>
                <th className="px-2 py-2.5 text-right font-medium">Profit After Discount</th>
                <th className="px-2 py-2.5 pr-4 text-right font-medium">Uncosted Sell</th>
              </tr>
            </thead>
            <tbody className={CARD_BODY}>
              {rows.map((r) => row(r, r.key))}
              {total ? row({ ...total, label: "Total" }, "__total", true) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-8 text-sm text-muted-foreground">No Work Order History in this range.</p>
      )}
      {more ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {more.shown} of {more.total}. An export has all {more.total}.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={more.onMore}>
            Show More
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function ProfitTable({
  title,
  rows,
  loading,
  empty,
  testId,
  more = null,
}: {
  title: string;
  rows: (GroupTotals & { key: string; label: string })[];
  loading: boolean;
  empty: string;
  testId: string;
  more?: { shown: number; total: number; onMore: () => void } | null;
}) {
  return (
    <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card" data-testid={testId}>
      <h2 className="border-b border-border px-4 py-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length ? (
        <div className="overflow-x-auto">
          <table className={`w-full text-sm sm:min-w-[52rem] ${CARD_TABLE}`}>
            <thead className={`text-left text-xs tracking-wide text-muted-foreground uppercase ${CARD_HEAD}`}>
              <tr className="border-b border-border">
                <th className="px-4 py-2.5 font-medium">{title === "By Job Type" ? "Job Type" : "Customer"}</th>
                <th className="px-2 py-2.5 text-right font-medium">Bills</th>
                <th className="px-2 py-2.5 text-right font-medium">Sell</th>
                <th className="px-2 py-2.5 text-right font-medium">Discount</th>
                <th className="px-2 py-2.5 text-right font-medium">Cost</th>
                <th className="px-2 py-2.5 text-right font-medium">Margin</th>
                <th className="px-2 py-2.5 text-right font-medium">Margin %</th>
                <th className="px-2 py-2.5 text-right font-medium">Sell With No Cost</th>
                <th className="px-2 py-2.5 pr-4 text-right font-medium">Estimated</th>
              </tr>
            </thead>
            <tbody className={CARD_BODY}>
              {rows.map((r) => (
                <tr key={r.key} className={`border-b border-border align-top last:border-b-0 ${CARD_ROW}`} data-testid="profit-group-row">
                  <td className={`px-4 py-2 font-medium ${CARD_LINE}`}>
                    {r.label}
                  </td>
                  <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Bills']`}>{r.bills}</td>
                  <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Sell']`}>{money(r.sell)}</td>
                  <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Discount']`}>{money(r.discount)}</td>
                  <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Cost']`}>{money(r.cost)}</td>
                  <td className={`tabular px-2 py-2 text-right font-medium ${r.margin < 0 ? "text-destructive" : ""} ${CARD_VALUE} max-sm:before:content-['Margin']`}>{money(r.margin)}</td>
                  <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['Margin_%']`}>{r.marginPct == null ? "—" : `${r.marginPct}%`}</td>
                  <td className={`tabular px-2 py-2 text-right ${CARD_VALUE} max-sm:before:content-['No_cost']`}>{money(r.uncostedSell)}</td>
                  <td className={`tabular px-2 py-2 pr-4 text-right ${CARD_VALUE} max-sm:before:content-['Estimated']`}>{r.estimated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-8 text-sm text-muted-foreground">{empty}</p>
      )}
      {more ? (
        <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>
            Showing {more.shown} of {more.total}. An export has all {more.total}.
          </span>
          <Button type="button" size="sm" variant="outline" onClick={more.onMore}>
            Show More
          </Button>
        </div>
      ) : null}
    </section>
  );
}
