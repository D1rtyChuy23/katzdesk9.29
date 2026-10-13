import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, FileType } from "lucide-react";
import { toast } from "sonner";
import { downloadAnalytics, getAnalytics } from "@/lib/ops/analytics-api";
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

function Page() {
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

      <StatRow>
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
        {/* From and To stay side by side, so the range never splits across two lines. */}
        <span className="flex shrink-0 items-center gap-2">
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
            className="h-9 w-[9.5rem] rounded-full"
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
            className="h-9 w-[9.5rem] rounded-full"
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
            <table className="w-full min-w-[56rem] text-sm">
              <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-2 py-2.5 font-medium">Account</th>
                  <th className="px-2 py-2.5 font-medium">Date</th>
                  <th className="px-2 py-2.5 font-medium">Status</th>
                  <th className="px-2 py-2.5 font-medium">Rep</th>
                  <th className="px-2 py-2.5 font-medium">Tech / Owner</th>
                  <th className="px-2 py-2.5 font-medium">Reference</th>
                  <th className="px-2 py-2.5 pr-4 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, shown).map((r) => (
                  <RecordRow key={`${r.type}-${r.id}`} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-4 py-8 text-sm text-muted-foreground">No records in this range. Widen the dates, or clear a filter.</p>
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
    <tr className="border-b border-border align-top last:border-b-0 hover:bg-muted/60" data-testid="analytics-row" data-type={r.type}>
      <td className="px-4 py-2 text-xs font-semibold tracking-[0.08em] text-copper uppercase">{ANALYTICS_LABEL[r.type]}</td>
      <td className="px-2 py-2">
        <OpenLink entityType={OPEN_AS[r.type]} id={r.id} className="font-medium hover:underline" title="Open this record">
          {r.account || "No account"}
        </OpenLink>
        {r.accountNumber ? <span className="block text-xs text-muted-foreground tabular">Account # {r.accountNumber}</span> : null}
      </td>
      <td className="tabular px-2 py-2 whitespace-nowrap">{r.date || "—"}</td>
      <td className="px-2 py-2">
        <StatusBadge status={r.status} tight />
      </td>
      <td className="px-2 py-2">{r.rep ? formatRep(r.rep) || r.rep : <span className="text-muted-foreground">No rep</span>}</td>
      <td className="px-2 py-2">{r.tech || <span className="text-muted-foreground">—</span>}</td>
      <td className="tabular px-2 py-2">{r.ref || <span className="text-muted-foreground">—</span>}</td>
      <td className="max-w-[18rem] px-2 py-2 pr-4 text-xs text-muted-foreground">
        <span className="line-clamp-2" title={r.detail}>
          {r.detail}
        </span>
      </td>
    </tr>
  );
}
