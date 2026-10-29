import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileDown, Braces } from "lucide-react";
import { getInvoicesReport, getLocationCheck, getTicketsInWindow, WINDOW_BOARDS } from "@/lib/ops/billing-report-api";
import {
  invoicesCsv,
  locationCsv,
  ticketFilterRow,
  windowCsv,
  windowFilterRow,
  type LocationCheckRow,
  type TicketBillingRow,
  type WindowRow,
} from "@/lib/ops/billing-report";
import {
  BOARD_LABEL,
  filtersToSearch,
  matchesBillingFilters,
  parseBillingFilters,
  type BillingFilters,
  type BoardKey,
  type DateBy,
} from "@/lib/ops/billing-rules";
import { todayChicago } from "@/lib/ops/clock";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/ui/select-field";
import { FilterChip, StatCard, StatRow } from "@/components/desk/desk-charts";
import { ListToolbar, ToolbarNote } from "@/components/desk/list-toolbar";
import { ShowMoreButton, useShowMore } from "@/components/desk/show-more";
import { OpenLink } from "@/components/desk/open-link";
import { TechFilter } from "@/components/desk/tech-select";
import { BillingFilterButton, BillingFilterPanel, PausedSearch, type FilterPatch } from "@/components/desk/billing-filters";
import { DoubleBillBadge, InvoiceStatusBadge } from "@/components/desk/ticket-invoices";
import { downloadCsv } from "@/components/desk/download-csv";

/**
 * Invoices (Admin, Grok's billing request through Chuy, 2026-10-28). Three views of the same billing:
 * - Invoices: every service and TLC ticket with its Sales Order and NetSuite invoices, the checks, and a CSV;
 * - Tickets In Window: every work order on Tickets, TLC, PMs and Installs received, completed or invoiced in a window
 *   (also as JSON for an Admin at /api/admin/tickets-in-window);
 * - Location Check: Corrigo service locations that aren't the ticket's account, and invoices billed from the wrong
 *   warehouse for the tech.
 * Read-only. The filters live in the address bar.
 */
type Tab = "invoices" | "window" | "location";
type InvoicesSearch = BillingFilters & { tab?: Exclude<Tab, "invoices"> };

export const Route = createFileRoute("/_app/invoices")({
  validateSearch: (s: Record<string, unknown>): InvoicesSearch => {
    const tab = s.tab === "window" || s.tab === "location" ? s.tab : undefined;
    return { ...parseBillingFilters(s), ...(tab ? { tab } : {}) };
  },
  component: Page,
});

const money = (n: number | null | undefined) => (n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));

const TABS: { id: Tab; label: string }[] = [
  { id: "invoices", label: "Invoices" },
  { id: "window", label: "Tickets In Window" },
  { id: "location", label: "Location Check" },
];

function Page() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/invoices" });
  const tab: Tab = search.tab ?? "invoices";
  const { tab: _tab, ...filters } = search;
  void _tab;
  // A change names only the keys it changes and lands on the address bar as it is then, so quick changes never clash.
  const patchFilters = (patch: FilterPatch) =>
    void navigate({
      search: (prev) => {
        const { tab: keep, ...rest } = prev;
        return { ...filtersToSearch({ ...rest, ...patch }), ...(keep ? { tab: keep } : {}) } as InvoicesSearch;
      },
      replace: true,
      resetScroll: false,
    });
  const setTab = (t: Tab) =>
    void navigate({
      search: (prev) => {
        const { tab: _old, ...rest } = prev;
        void _old;
        return { ...rest, ...(t === "invoices" ? {} : { tab: t }) } as InvoicesSearch;
      },
      replace: true,
      resetScroll: false,
    });
  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Invoices</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          What each ticket billed in NetSuite: its Sales Order, invoices and checks. Read-only; invoices come in through
          Billing Backfill (NetSuite) on Tickets. Filters stay in the address bar, so a filtered list can be bookmarked.
        </p>
      </header>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Views" data-testid="invoices-tabs">
        {TABS.map((t) => (
          <FilterChip key={t.id} selected={tab === t.id} onClick={() => setTab(t.id)} data-testid={`invoices-tab-${t.id}`}>
            {t.label}
          </FilterChip>
        ))}
      </div>
      {tab === "invoices" ? <InvoicesView filters={filters} onFilters={patchFilters} /> : null}
      {tab === "window" ? <WindowView filters={filters} onFilters={patchFilters} /> : null}
      {tab === "location" ? <LocationView filters={filters} onFilters={patchFilters} /> : null}
    </div>
  );
}

function Forbidden() {
  return (
    <p className="mt-6 rounded-xl border border-dashed border-border bg-card/60 px-5 py-6 text-center text-sm text-muted-foreground" data-testid="invoices-forbidden">
      Only an Admin can open Invoices. Ask the desk owner for the Admin role.
    </p>
  );
}

function ExportCsvButton({ onClick, disabled, testId }: { onClick: () => void; disabled?: boolean; testId: string }) {
  return (
    <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 rounded-full" onClick={onClick} disabled={disabled} data-testid={testId}>
      <FileDown className="size-4" />
      Export CSV
    </Button>
  );
}

// ── Invoices ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const hasLive = (r: TicketBillingRow) => r.invoices.some((i) => !/^void/i.test(i.status.replace(/[^A-Za-z]/g, "")));

function InvoicesView({ filters, onFilters }: { filters: BillingFilters; onFilters: (patch: FilterPatch) => void }) {
  const report = useQuery({ queryKey: ["billing-invoices", "report"], queryFn: () => getInvoicesReport() });
  const all = useMemo(() => report.data?.rows ?? [], [report.data]);
  const [open, setOpen] = useState(() => Object.keys(filters).some((k) => k !== "q"));
  const rows = useMemo(() => all.filter((r) => matchesBillingFilters(ticketFilterRow(r), filters)), [all, filters]);
  const page = useShowMore(rows, JSON.stringify(filters));
  const statuses = useMemo(() => [...new Set(all.map((r) => r.status).filter(Boolean))], [all]);
  const counts = useMemo(
    () => ({
      invoiced: all.filter(hasLive).length,
      // The same test as the card's filter: Completed, no Sales Order, no invoice.
      noSo: all.filter((r) => r.status.trim().toLowerCase() === "completed" && !r.so && !hasLive(r)).length,
      soNoInvoice: all.filter((r) => r.so && !hasLive(r)).length,
      double: all.filter((r) => r.doubleBill).length,
      mismatch: all.filter((r) => r.mismatch).length,
      location: all.filter((r) => r.locationWarnings.length).length,
    }),
    [all],
  );
  if (report.data?.forbidden) return <Forbidden />;
  // A card that is on turns its filters off; otherwise it sets them.
  const toggle = (patch: FilterPatch, on: boolean) =>
    onFilters(on ? (Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) as FilterPatch) : patch);
  const is = (patch: FilterPatch) => Object.entries(patch).every(([k, v]) => filters[k as keyof BillingFilters] === v);
  const chip = (patch: FilterPatch) => () => toggle(patch, is(patch));
  return (
    <section className="mt-2" data-testid="invoices-view">
      <StatRow loaded={report.isSuccess}>
        <StatCard label="Invoiced" value={counts.invoiced} hint="A NetSuite invoice that isn't Voided" selected={is({ invoice: "yes" })} onClick={chip({ invoice: "yes" })} />
        <StatCard
          label="Completed, No SO"
          value={counts.noSo}
          tone={counts.noSo ? "warn" : undefined}
          hint="Not billed yet"
          selected={is({ so: "no", invoice: "no", status: "Completed" })}
          onClick={chip({ so: "no", invoice: "no", status: "Completed" })}
        />
        <StatCard label="SO, No Invoice" value={counts.soNoInvoice} hint="Sales Order, nothing invoiced yet" selected={is({ so: "yes", invoice: "no" })} onClick={chip({ so: "yes", invoice: "no" })} />
        <StatCard label="Double Bill?" value={counts.double} tone={counts.double ? "danger" : undefined} hint="Two or more invoices over the charges" selected={is({ double: true })} onClick={chip({ double: true })} />
        <StatCard label="Mismatch" value={counts.mismatch} tone={counts.mismatch ? "warn" : undefined} hint="Charges don't match the invoices" selected={is({ mismatch: true })} onClick={chip({ mismatch: true })} />
      </StatRow>
      <ListToolbar>
        <PausedSearch value={filters.q ?? ""} onChange={(v) => onFilters({ q: v || undefined })} placeholder="Search WO, account, SO, invoice…" testId="invoices-search" />
        <TechFilter value={filters.tech ?? ""} onChange={(v) => onFilters({ tech: v || undefined })} extraNames={all.map((r) => r.technician)} className="h-9 w-40 rounded-full pr-8" />
        <BillingFilterButton value={filters} open={open} onToggle={() => setOpen((o) => !o)} />
        <ExportCsvButton testId="invoices-export-csv" disabled={!rows.length} onClick={() => downloadCsv(`invoices-${todayChicago()}.csv`, invoicesCsv(rows))} />
        <ToolbarNote data-testid="invoices-count">
          {rows.length} of {all.length} tickets{counts.location ? ` · ${counts.location} with a location warning` : ""}
        </ToolbarNote>
      </ListToolbar>
      {open ? <BillingFilterPanel value={filters} onPatch={onFilters} statuses={statuses} boards={["service", "tlc"]} billing /> : null}
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[60rem] text-left text-sm" data-testid="invoices-table">
          <thead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-2">Ticket</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Sales Order</th>
              <th className="px-3 py-2">NetSuite Invoices</th>
              <th className="px-3 py-2 text-right">Charges</th>
              <th className="px-3 py-2 text-right">Invoiced</th>
            </tr>
          </thead>
          <tbody>
            {report.isLoading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : report.isError ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted-foreground">
                  Couldn&apos;t load the invoices. Reload the page to try again.
                </td>
              </tr>
            ) : !rows.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-muted-foreground">
                  {all.length ? "Nothing matches these filters." : "No tickets yet."}
                </td>
              </tr>
            ) : (
              page.visible.map((r) => <InvoiceRow key={r.id} r={r} />)
            )}
          </tbody>
        </table>
        <ShowMoreButton remaining={page.remaining} onClick={page.showMore} label="tickets" />
      </div>
    </section>
  );
}

function InvoiceRow({ r }: { r: TicketBillingRow }) {
  return (
    <tr className="border-b border-border align-top last:border-b-0" data-testid="invoices-row">
      <td className="px-4 py-2.5">
        <OpenLink entityType={r.board} id={r.id} className="font-medium text-primary underline-offset-2 hover:underline">
          {r.wo || r.callId}
        </OpenLink>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {BOARD_LABEL[r.board]} #{r.id}
          {r.completed ? ` · done ${r.completed}` : r.received ? ` · in ${r.received}` : ""}
        </span>
        <span className="mt-1 flex flex-wrap gap-1">
          <DoubleBillBadge on={r.doubleBill} />
          {r.mismatch ? (
            <Badge variant="warn" size="tight" data-testid="mismatch-badge">
              Charges ≠ invoices
            </Badge>
          ) : null}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="block">{r.customer || "—"}</span>
        <span className="block text-[11px] text-muted-foreground">{[r.technician, r.secondaryTech].filter(Boolean).join(" + ") || "No tech"}</span>
        {r.locationWarnings.map((w) => (
          <span key={w} className="mt-0.5 block text-[11px] text-warning" data-testid="invoices-location-warning">
            {w}
          </span>
        ))}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">{r.status}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {r.so ? (
          <>
            <span className="font-medium">{r.so}</span>
            {r.billedAt ? <span className="block text-[11px] text-muted-foreground">billed {r.billedAt}</span> : null}
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-3 py-2.5">
        {r.invoices.length ? (
          <ul className="space-y-1">
            {r.invoices.map((i) => (
              <li key={i.invoice} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="font-medium">{i.invoice}</span>
                <InvoiceStatusBadge status={i.status} />
                <span className="text-[11px] text-muted-foreground">
                  {[i.date, i.total != null ? money(i.total) : null, i.remaining ? `${money(i.remaining)} open` : null, i.location].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-muted-foreground">None</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {r.chargeLines ? money(r.chargeNet) : <span className="text-muted-foreground">No charges</span>}
      </td>
      <td className="px-3 py-2.5 text-right tabular whitespace-nowrap">
        {r.invoices.length ? money(r.liveTotal) : <span className="text-muted-foreground">—</span>}
        {r.corrigoNet != null ? <span className="block text-[11px] text-muted-foreground">Corrigo {money(r.corrigoNet)}</span> : null}
      </td>
    </tr>
  );
}

// ── Tickets In Window ────────────────────────────────────────────────────────────────────────────────────────────────

/** The month so far: the window when none is picked. */
function monthSoFar(): { from: string; to: string } {
  const today = todayChicago();
  return { from: `${today.slice(0, 8)}01`, to: today };
}

function lastMonth(): { from: string; to: string } {
  const today = todayChicago();
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  const last = new Date(Date.UTC(py, pm, 0)).getUTCDate();
  const mm = String(pm).padStart(2, "0");
  return { from: `${py}-${mm}-01`, to: `${py}-${mm}-${String(last).padStart(2, "0")}` };
}

function WindowView({ filters, onFilters }: { filters: BillingFilters; onFilters: (patch: FilterPatch) => void }) {
  const fallback = monthSoFar();
  const from = filters.dateFrom ?? fallback.from;
  const to = filters.dateTo ?? fallback.to;
  const dateBy: DateBy = filters.dateBy ?? "completed";
  const boards: BoardKey[] = filters.board ? [filters.board] : WINDOW_BOARDS;
  const report = useQuery({
    queryKey: ["billing-invoices", "window", from, to, dateBy, boards.join(",")],
    queryFn: () => getTicketsInWindow({ data: { from, to, dateBy, boards } }),
  });
  const all = useMemo(() => report.data?.rows ?? [], [report.data]);
  // The window itself is read on the server; the rest narrows here.
  const rest: BillingFilters = { q: filters.q, status: filters.status, account: filters.account, tech: filters.tech };
  const rows = useMemo(() => all.filter((r) => matchesBillingFilters(windowFilterRow(r), rest)), [all, rest.q, rest.status, rest.account, rest.tech]); // eslint-disable-line react-hooks/exhaustive-deps
  const page = useShowMore(rows, JSON.stringify(filters));
  const byBoard = useMemo(() => {
    const m = new Map<BoardKey, number>();
    for (const r of rows) m.set(r.board, (m.get(r.board) ?? 0) + 1);
    return m;
  }, [rows]);
  const statuses = useMemo(() => [...new Set(all.map((r) => r.status).filter(Boolean))], [all]);
  if (report.data?.forbidden) return <Forbidden />;
  const set = (patch: FilterPatch) => onFilters(patch);
  const jsonHref = `/api/admin/tickets-in-window?${new URLSearchParams({ from, to, dateBy, board: boards.join(",") }).toString()}`;
  return (
    <section className="mt-4" data-testid="window-view">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-3 text-sm">
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Window by</span>
          <SelectField className="h-9 w-36 text-sm" value={dateBy} onChange={(e) => set({ dateBy: e.target.value === "completed" ? undefined : (e.target.value as DateBy) })} data-testid="window-date-by">
            <option value="completed">Completed</option>
            <option value="received">Received</option>
            <option value="invoiced">Invoiced</option>
          </SelectField>
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">From</span>
          <Input type="date" className="h-9 w-40 text-sm" value={from} onChange={(e) => set({ dateFrom: e.target.value || undefined })} data-testid="window-from" />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">To</span>
          <Input type="date" className="h-9 w-40 text-sm" value={to} onChange={(e) => set({ dateTo: e.target.value || undefined })} data-testid="window-to" />
        </label>
        <label className="grid gap-1">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Board</span>
          <SelectField className="h-9 w-40 text-sm" value={filters.board ?? ""} onChange={(e) => set({ board: (e.target.value || undefined) as BoardKey | undefined })} allowEmpty emptyLabel="Every board" data-testid="window-board">
            {WINDOW_BOARDS.map((b) => (
              <option key={b} value={b}>
                {BOARD_LABEL[b]}
              </option>
            ))}
          </SelectField>
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => set({ dateFrom: monthSoFar().from, dateTo: monthSoFar().to })}>
            This month
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => set({ dateFrom: lastMonth().from, dateTo: lastMonth().to })}>
            Last month
          </Button>
        </div>
      </div>
      <ListToolbar>
        <PausedSearch value={filters.q ?? ""} onChange={(v) => set({ q: v || undefined })} placeholder="Search WO, account, SO…" testId="window-search" />
        <TechFilter value={filters.tech ?? ""} onChange={(v) => set({ tech: v || undefined })} extraNames={all.map((r) => r.technician)} className="h-9 w-40 rounded-full pr-8" />
        <SelectField className="h-9 w-40 rounded-full pr-8 text-sm" value={filters.status ?? ""} onChange={(e) => set({ status: e.target.value || undefined })} allowEmpty emptyLabel="Any status" aria-label="Status">
          {[...statuses].sort().map((s) => (
            <option key={s}>{s}</option>
          ))}
        </SelectField>
        <ExportCsvButton testId="window-export-csv" disabled={!rows.length} onClick={() => downloadCsv(`tickets-in-window-${from}-to-${to}.csv`, windowCsv(rows))} />
        <a href={jsonHref} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-primary underline-offset-2 hover:underline" data-testid="window-json">
          <Braces className="size-4" />
          JSON
        </a>
        <ToolbarNote data-testid="window-count">
          {report.data?.error
            ? report.data.error
            : `${rows.length} work orders · ${[...byBoard].map(([b, n]) => `${n} ${BOARD_LABEL[b]}`).join(" · ") || "none"}`}
        </ToolbarNote>
      </ListToolbar>
      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[56rem] text-left text-sm" data-testid="window-table">
          <thead className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-4 py-2">WO</th>
              <th className="px-3 py-2">Account</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Received</th>
              <th className="px-3 py-2">Completed</th>
              <th className="px-3 py-2">SO / Invoices</th>
            </tr>
          </thead>
          <tbody>
            {report.isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : !rows.length ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-muted-foreground">
                  {report.data?.error ?? "Nothing in this window."}
                </td>
              </tr>
            ) : (
              page.visible.map((r) => <WindowRowView key={`${r.board}-${r.id}-${r.wo ?? ""}`} r={r} />)
            )}
          </tbody>
        </table>
        <ShowMoreButton remaining={page.remaining} onClick={page.showMore} label="work orders" />
      </div>
    </section>
  );
}

function WindowRowView({ r }: { r: WindowRow }) {
  return (
    <tr className="border-b border-border align-top last:border-b-0" data-testid="window-row">
      <td className="px-4 py-2.5">
        <OpenLink entityType={r.board} id={r.id} className="font-medium text-primary underline-offset-2 hover:underline">
          {r.wo || `#${r.id}`}
        </OpenLink>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {BOARD_LABEL[r.board]} #{r.id}
          {r.note ? ` · ${r.note}` : ""}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <span className="block">{r.customer || "—"}</span>
        <span className="block text-[11px] text-muted-foreground">{r.technician || "No tech"}</span>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">{r.status || "—"}</td>
      <td className="px-3 py-2.5 whitespace-nowrap tabular">{r.received ?? "—"}</td>
      <td className="px-3 py-2.5 whitespace-nowrap tabular">{r.completed ?? "—"}</td>
      <td className="px-3 py-2.5">
        {r.so ? <span className="block font-medium">{r.so}</span> : null}
        {r.invoices.map((i) => (
          <span key={i.invoice} className="flex flex-wrap items-center gap-1.5 text-xs">
            {i.invoice} <InvoiceStatusBadge status={i.status} />
          </span>
        ))}
        {!r.so && !r.invoices.length ? <span className="text-muted-foreground">—</span> : null}
      </td>
    </tr>
  );
}

// ── Location Check ───────────────────────────────────────────────────────────────────────────────────────────────────

function LocationView({ filters, onFilters }: { filters: BillingFilters; onFilters: (patch: FilterPatch) => void }) {
  const report = useQuery({ queryKey: ["billing-invoices", "location"], queryFn: () => getLocationCheck() });
  const all = useMemo(() => report.data?.rows ?? [], [report.data]);
  const needle = (filters.q ?? "").trim().toLowerCase();
  const rows = useMemo(
    () =>
      all.filter(
        (r) =>
          (!filters.board || r.board === filters.board) &&
          (!needle || [r.wo, r.customer, r.technician, r.serviceLocation, r.locationAccount, r.invoice, r.invoiceLocation].some((w) => (w ?? "").toLowerCase().includes(needle))),
      ),
    [all, filters.board, needle],
  );
  if (report.data?.forbidden) return <Forbidden />;
  const accounts = rows.filter((r) => r.kind === "account");
  const warehouses = rows.filter((r) => r.kind === "warehouse");
  return (
    <section className="mt-2" data-testid="location-view">
      <ListToolbar>
        <PausedSearch value={filters.q ?? ""} onChange={(v) => onFilters({ q: v || undefined })} placeholder="Search WO, account, location…" testId="location-search" />
        <ExportCsvButton testId="location-export-csv" disabled={!rows.length} onClick={() => downloadCsv(`location-check-${todayChicago()}.csv`, locationCsv(rows))} />
        <ToolbarNote data-testid="location-count">
          {accounts.length} account check{accounts.length === 1 ? "" : "s"} · {warehouses.length} warehouse warning{warehouses.length === 1 ? "" : "s"}
        </ToolbarNote>
      </ListToolbar>
      {report.isLoading ? <p className="mt-6 text-sm text-muted-foreground">Loading…</p> : null}
      {report.isSuccess ? (
        <>
          <LocationSection
            title="Account vs Corrigo service location"
            hint="The ticket's account isn't the service location Corrigo names (its ServiceChannel id left off). Fix the account on the ticket when the location is right."
            rows={accounts}
            empty="Every ticket's account matches its Corrigo service location (or Corrigo gave none)."
            testId="location-accounts"
          />
          <LocationSection
            title="Warehouse rule"
            hint="Lance Oden bills from San Antonio WH and Bill McKinley from Dallas WH. These invoices came from another location."
            rows={warehouses}
            empty="No invoice breaks the warehouse rule."
            testId="location-warehouse"
          />
        </>
      ) : null}
    </section>
  );
}

function LocationSection({ title, hint, rows, empty, testId }: { title: string; hint: string; rows: LocationCheckRow[]; empty: string; testId: string }) {
  const page = useShowMore(rows, rows.length);
  return (
    <section className="mt-5 rounded-xl border border-border bg-card" data-testid={testId}>
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
          {title} · {rows.length}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {rows.length ? (
        <ul>
          {page.visible.map((r) => (
            <li key={`${r.kind}-${r.board}-${r.id}-${r.invoice ?? ""}`} className="border-b border-border px-4 py-2.5 text-sm last:border-b-0" data-testid="location-row">
              <OpenLink entityType={r.board} id={r.id} className="font-medium text-primary underline-offset-2 hover:underline">
                {r.wo || `#${r.id}`}
              </OpenLink>{" "}
              <span className="text-muted-foreground">
                · {BOARD_LABEL[r.board]} · {r.customer || "no account"}
                {r.technician ? ` · ${r.technician}` : ""}
                {r.invoice ? ` · ${r.invoice}` : ""}
              </span>
              <span className="mt-0.5 block text-xs text-warning">{r.note}</span>
            </li>
          ))}
          <ShowMoreButton as="li" remaining={page.remaining} onClick={page.showMore} label="rows" />
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}
