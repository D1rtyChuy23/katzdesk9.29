import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, FileType } from "lucide-react";
import { toast } from "sonner";
import { downloadAnalytics, getAnalytics } from "@/lib/ops/analytics-api";
import { downloadPartsProfit, getPartsProfit } from "@/lib/ops/parts-profit-api";
import { getMyAccess } from "@/lib/ops/access";
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

type ReportView = "records" | "profit";

function Page() {
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const isAdmin = !!me.data?.isAdmin || me.data?.role === "admin";
  const [view, setView] = useState<ReportView>("records");
  // Parts Profit shows cost and margin, so it is Admin only; everyone else sees the records report.
  const switcher = isAdmin ? (
    <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="Report" data-testid="analytics-report-switch">
      <FilterChip selected={view === "records"} onClick={() => setView("records")} data-testid="analytics-view-records">
        Records
      </FilterChip>
      <FilterChip selected={view === "profit"} onClick={() => setView("profit")} data-testid="analytics-view-profit">
        Parts Profit
      </FilterChip>
    </div>
  ) : null;
  return view === "profit" && isAdmin ? <PartsProfitView switcher={switcher} /> : <RecordsView switcher={switcher} />;
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
            className="h-9 w-[8.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem]"
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
            className="h-9 w-[9.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem]"
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
            Parts Profit: every part on an invoiced ticket, by MPN. Cost comes from Our Discount Rule (or the NetSuite Purchase Price), and is stored when the
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
            <Input type="date" value={dates.from} max={dates.to || undefined} onChange={(e) => { setRange("custom"); setDates((x) => ({ ...x, from: e.target.value })); }} className="h-9 w-[8.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem]" aria-label="From date" />
          </label>
          <label className="flex h-9 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            To
            <Input type="date" value={dates.to} min={dates.from || undefined} onChange={(e) => { setRange("custom"); setDates((x) => ({ ...x, to: e.target.value })); }} className="h-9 w-[9.25rem] rounded-full max-sm:px-2 sm:w-[9.5rem]" aria-label="To date" />
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
