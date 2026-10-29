import { useEffect, useMemo, useState } from "react";
import { WoHistoryImportButton } from "@/components/desk/wo-history-import";
import { useBackTo, type TicketSearch, type TicketView } from "@/lib/ops/search-params";
import { ImportPartsButton, UpdatePricingButton } from "@/components/desk/part-imports";
import { SalesScopeNote } from "@/components/desk/sales-scope-note";
import { AddressLine } from "@/components/desk/customer-address";
import { useQuery } from "@tanstack/react-query";
import { findWoTickets, listJobs } from "@/lib/ops/api";
import { withWoMatches, woBoardName, woSearchKey } from "@/lib/ops/wo-search";
import { OpenLink } from "./open-link";
import { getMyAccess } from "@/lib/ops/access";
import { BillingExportButton, ItemListImportButton } from "./billing-tools";
import { BillingBackfillButton } from "./billing-backfill";
import { URGENCIES, URGENCY_RANK } from "@/lib/ops/lookups";
import { isClosedCall, isOpenCall } from "@/lib/ops/ticket-status";
import { formatShortDate } from "@/lib/ops/clock";
import type { ServiceJob } from "@/lib/ops/types";
import { Button } from "@/components/ui/button";
import { DuplicateBadge, FlagBadge, StatusBadge, UrgencyBadge } from "./flag-badge";
import { JobSheet, NewJobDialog } from "./job-sheet";
import { CorrigoImportButton, CorrigoReviewList, type CorrigoReviewItem } from "./corrigo-import";
import { SortSelect, useDeskSort } from "./sort-bar";
import { ActionButton, ActionMenu, ImportMenu, StatCard, StatRow, toggleChip } from "./desk-charts";
import { SORT_LIST, equipmentCount, sortDesk } from "@/lib/ops/sort";
import { Plus } from "lucide-react";
import { ExportButton } from "./export-dialog";
import { FileDown } from "lucide-react";
import { listTicketBilling } from "@/lib/ops/billing-report-api";
import { jobFilterRow, ticketsCsv, type TicketBillingRow } from "@/lib/ops/billing-report";
import { matchesBillingFilters, type BillingFilters } from "@/lib/ops/billing-rules";
import { todayChicago } from "@/lib/ops/clock";
import { BillingFilterButton, BillingFilterPanel, type FilterPatch } from "./billing-filters";
import { usePausedValue } from "./use-paused-value";
import { DoubleBillBadge } from "./ticket-invoices";
import { downloadCsv } from "./download-csv";
import { ListToolbar, ToolbarSearch, ToolbarSelect, TOOLBAR_SELECT } from "./list-toolbar";
import { TechFilter, TechName } from "./tech-select";
import { sameTech } from "@/lib/ops/tech-match";
import { mineByTechnician } from "@/lib/ops/my-view";
import { AkBadge } from "./ak-badge";
import { useMyView } from "./my-view-bar";
import { notLoadedText } from "@/lib/ops/load-problem";


/** The billing filters: an Admin's (10/28). */
const BILLING_KEYS = ["so", "invoice", "invStatus", "double", "mismatch"] as const;
/** The panel's filters, besides the search box. */
const PANEL_KEYS = ["dateBy", "dateFrom", "dateTo", "status", "account", "tech", ...BILLING_KEYS] as const;

export function JobsPage({
  kind,
  title,
  lede,
  initialOpen,
  from,
  initialTab,
  search = {},
  onSearch,
}: {
  kind: "service" | "tlc";
  title: string;
  lede: string;
  initialOpen?: number;
  /** The page that opened the ticket; closing it goes back there. */
  from?: string;
  /** A ping or note notification opens its ticket on the Ping tab. */
  initialTab?: "ping";
  /** The list's view, search and filters, from the address bar (10/28). */
  search?: TicketSearch;
  /** Change the list's view, search or filters in the address bar. */
  onSearch?: (patch: Partial<TicketSearch>) => void;
}) {
  const jobs = useQuery({
    queryKey: ["jobs", kind],
    queryFn: () => listJobs({ data: { kind } }),
  });
  // Each ticket's Sales Order, NetSuite invoices and double-bill flag. Under "jobs" so an import refreshes it.
  const billing = useQuery({
    queryKey: ["jobs", "billing", kind],
    queryFn: () => listTicketBilling({ data: { kind } }),
  });
  const billingById = useMemo(() => new Map((billing.data ?? []).map((b) => [b.id, b] as const)), [billing.data]);
  const { filterMine, matchMine, role } = useMyView();
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  const isAdmin = !!(me.data?.isAdmin || me.data?.role === "admin");
  const setSearch = (patch: Partial<TicketSearch>) => onSearch?.(patch);
  // The search box answers each key at once; the address bar catches up when typing pauses.
  const [q, setQ] = usePausedValue(search.q ?? "", (v) => setSearch({ q: v.trim() ? v : undefined }));

  const tech = search.tech ?? "";
  const setTech = (v: string) => setSearch({ tech: v || undefined });
  const urgency = search.urgency ?? "";
  const setUrgency = (v: string) => setSearch({ urgency: v || undefined });
  const view: TicketView = search.view ?? "active";
  const setView = (next: TicketView | ((v: TicketView) => TicketView)) =>
    setSearch({ view: (typeof next === "function" ? next(view) : next) as TicketSearch["view"] });
  // An Admin's billing filters apply; anyone else's address bar can't narrow by them.
  const filters: BillingFilters = useMemo(() => {
    const f: BillingFilters = {};
    for (const k of PANEL_KEYS) {
      if (k === "tech") continue;
      if (!isAdmin && (BILLING_KEYS as readonly string[]).includes(k)) continue;
      if (!isAdmin && k === "dateBy" && search.dateBy === "invoiced") continue;
      const v = search[k];
      if (v !== undefined) (f as Record<string, unknown>)[k] = v;
    }
    return f;
  }, [search, isAdmin]);
  const [filtersOpen, setFiltersOpen] = useState(() => PANEL_KEYS.some((k) => k !== "tech" && search[k] !== undefined));
  const panelValue: BillingFilters = { ...filters, ...(search.tech ? { tech: search.tech } : {}), ...(search.q ? { q: search.q } : {}) };
  /** Only the keys the change names: the address bar as it is then keeps the rest (two quick changes never clash). */
  function applyPanel(change: FilterPatch) {
    const patch: Partial<TicketSearch> = {};
    for (const k of PANEL_KEYS) if (k in change) (patch as Record<string, unknown>)[k] = change[k];
    // A date, status or billing filter looks past the open calls: Active would hide most of what it finds.
    const narrows = PANEL_KEYS.some((k) => k !== "tech" && k !== "account" && k !== "dateBy" && change[k] !== undefined);
    if (narrows && view === "active") patch.view = "all";
    setSearch(patch);
  }
  const [openId, setOpenId] = useState<number | null>(initialOpen ?? null);
  const back = useBackTo(from);
  const [openTab, setOpenTab] = useState<"ping" | undefined>(initialOpen != null ? initialTab : undefined);
  useEffect(() => {
    if (initialOpen != null) {
      setOpenId(initialOpen);
      setOpenTab(initialTab);
    }
  }, [initialOpen, initialTab]);
  // A ticket opened from the list or New call opens on its Ticket tab.
  const openFromList = (id: number) => {
    setOpenTab(undefined);
    setOpenId(id);
  };
  const [create, setCreate] = useState(false);
  const [review, setReview] = useState<CorrigoReviewItem[]>([]);
  const [sort, setSort] = useDeskSort(`jobs-${kind}`, "flag");

  const rows = useMemo(() => {
    let list = jobs.data ?? [];
    if (view === "active") {
      list = list.filter((j) => !j.duplicateOf && isOpenCall(j));
    }
    if (view === "flagged") {
      list = list.filter((j) => j.flag || j.duplicateOf || (j.siblings?.length ?? 0) > 0);
    }
    if (view === "unassigned") {
      list = list.filter((j) => !j.duplicateOf && isOpenCall(j) && !j.technician);
    }
    if (view === "complete") {
      list = list.filter((j) => !j.duplicateOf && isClosedCall(j));
    }
    if (tech) list = list.filter((j) => sameTech(j.technician, tech) || sameTech(j.secondaryTech, tech));
    list = mineByTechnician(list, { filterMine, role, matchMine });
    if (urgency) list = list.filter((j) => j.urgency === urgency);
    if (Object.keys(filters).length) list = list.filter((j) => matchesBillingFilters(jobFilterRow(j, billingById.get(j.id)), filters));

    const needle = q.trim().toLowerCase();
    if (needle) {
      list = list.filter((j) =>
        [j.customer, j.callId, j.wo, j.issue, j.equipment, j.technician, j.secondaryTech]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(needle)),
      );
    }
    // A WO number finds its ticket in any status, view or filter.
    list = withWoMatches(list, jobs.data ?? [], q);
    return sortDesk(list, sort, {
      date: (j) => j.received ?? j.scheduled,
      name: (j) => j.customer,
      equipment: (j) => equipmentCount(j.equipment),
      status: (j) => j.status,
      flagRank: (j) => (j.flag ? j.flag.rank : 50) + (URGENCY_RANK[j.urgency] ?? 2) / 10,
      tech: (j) => j.technician,
    });
  }, [jobs.data, q, tech, urgency, view, sort, filterMine, matchMine, role, filters, billingById]);

  // The same WO on another board (PM, Install, the other ticket list): say where it is.
  const woKey = woSearchKey(q);
  const elsewhere = useQuery({
    // Under "jobs" so a Corrigo import refreshes it.
    queryKey: ["jobs", "wo-elsewhere", woKey],
    queryFn: () => findWoTickets({ data: { q } }),
    enabled: !!woKey,
  });
  const otherBoards = woKey ? (elsewhere.data ?? []).filter((h) => h.entityType !== kind) : [];
  const liveJobs = (jobs.data ?? []).filter((j) => !j.duplicateOf);
  const activeCount = liveJobs.filter((j) => isOpenCall(j)).length;
  const flagCount = (jobs.data ?? []).filter(
    (j) => j.flag || j.duplicateOf || (j.siblings?.length ?? 0) > 0,
  ).length;
  const allJobs = liveJobs;
  const activeJobs = allJobs.filter((j) => isOpenCall(j));
  const unassignedCount = activeJobs.filter((j) => !j.technician).length;
  const completeCount = liveJobs.filter((j) => isClosedCall(j)).length;
  const doubleCount = liveJobs.filter((j) => billingById.get(j.id)?.doubleBill).length;
  const statuses = useMemo(() => [...new Set((jobs.data ?? []).map((j) => j.status).filter(Boolean))], [jobs.data]);
  const needsBilling = Object.keys(filters).some((k) => (BILLING_KEYS as readonly string[]).includes(k) || (k === "dateBy" && filters.dateBy === "invoiced"));
  function exportList() {
    downloadCsv(`${kind === "tlc" ? "tlc" : "tickets"}-${todayChicago()}.csv`, ticketsCsv(rows, isAdmin ? billingById : null));
  }

  return (
    <div>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-medium tracking-tight">{title}</h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">{lede}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {/* Imports live on Tickets only. More than one: the Import list. One: its own button. */}
          <ImportMenu>
            {/* Every import is Admin only (the Corrigo import too, 10/28). */}
            {kind === "service" && isAdmin ? <CorrigoImportButton onImported={setReview} /> : null}
            {kind === "service" && isAdmin ? <BillingBackfillButton /> : null}
            {kind === "service" && isAdmin ? <ItemListImportButton /> : null}
            {kind === "service" && isAdmin ? <ImportPartsButton /> : null}
            {kind === "service" && isAdmin ? <UpdatePricingButton /> : null}
            {kind === "service" && isAdmin ? <WoHistoryImportButton /> : null}
          </ImportMenu>
          <ActionMenu label="Export">
            <BillingExportButton />
            <ExportButton defaultType={kind === "tlc" ? "tlc" : "pending"} />
            <ActionButton icon={FileDown} menuLabel={`This List (${rows.length}) As CSV`} onClick={exportList} disabled={!jobs.isSuccess} data-testid="tickets-export-csv">
              Export This List
            </ActionButton>
          </ActionMenu>
          <Button onClick={() => setCreate(true)}>
            <Plus className="size-4" />
            New call
          </Button>
        </div>
      </header>
      <SalesScopeNote />

      <StatRow loaded={jobs.isSuccess}>
        <StatCard
          label="Active"
          value={activeCount}
          hint={`${allJobs.length} in history`}
          selected={view === "active"}
          onClick={() => setView((v) => toggleChip(v, "active", "all"))}
        />
        <StatCard
          label="Flagged"
          value={flagCount}
          tone={flagCount ? "danger" : undefined}
          hint={kind === "service" ? "48-hour clock" : "2-week clock"}
          selected={view === "flagged"}
          onClick={() => setView((v) => toggleChip(v, "flagged", "all"))}
        />
        <StatCard
          label="Unassigned"
          value={unassignedCount}
          hint="Active calls with no tech"
          selected={view === "unassigned"}
          onClick={() => setView((v) => toggleChip(v, "unassigned", "all"))}
        />
        <StatCard
          label="Complete"
          value={completeCount}
          hint="Closed tickets"
          selected={view === "complete"}
          onClick={() => setView((v) => toggleChip(v, "complete", "all"))}
        />
        {isAdmin && doubleCount ? (
          <StatCard
            label="Double Bill?"
            value={doubleCount}
            tone="danger"
            hint="Two or more invoices over the charges"
            selected={!!search.double}
            onClick={() => applyPanel({ double: search.double ? undefined : true })}
          />
        ) : null}
      </StatRow>

      {kind === "service" ? (
        <CorrigoReviewList
          items={review}
          onDismiss={() => setReview([])}
        />
      ) : null}

      <ListToolbar>
        <ToolbarSearch value={q} onChange={setQ} placeholder="Search tickets…" />
        <TechFilter
          value={tech}
          onChange={setTech}
          extraNames={(jobs.data ?? []).map((j) => j.technician)}
          className={`${TOOLBAR_SELECT} ${HALF_ROW_ON_PHONE}`}
        />
        <ToolbarSelect value={urgency} onChange={(e) => setUrgency(e.target.value)} allowEmpty emptyLabel="All urgency" aria-label="Filter by urgency" className={HALF_ROW_ON_PHONE}>
          {URGENCIES.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </ToolbarSelect>
        <SortSelect value={sort} onChange={setSort} options={SORT_LIST} className="shrink-0 max-sm:w-full" />
        <BillingFilterButton value={filters} open={filtersOpen} onToggle={() => setFiltersOpen((o) => !o)} />
      </ListToolbar>
      {filtersOpen ? (
        <BillingFilterPanel value={panelValue} onPatch={applyPanel} statuses={statuses} billing={isAdmin} />
      ) : null}
      {needsBilling && billing.isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">Loading the billing to filter by…</p>
      ) : null}

      {otherBoards.length ? (
        <ul className="mt-3 space-y-1 text-sm" data-testid="wo-other-boards">
          {otherBoards.map((h) => (
            <li key={`${h.entityType}-${h.id}`}>
              <OpenLink entityType={h.entityType} id={h.id} className="text-primary underline-offset-2 hover:underline">
                {h.wo} is on {woBoardName(h.entityType)} · {h.status}{h.customer ? ` · ${h.customer}` : ""}
              </OpenLink>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-card">
        <div className="min-w-0">
        <div className="hidden grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_5.5rem_8.5rem_4.5rem_4.5rem_7rem] gap-3 border-b border-border px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase xl:grid">
          <span>Account</span>
          <span>Why it matters</span>
          <span>Urgency</span>
          <span>Status</span>
          <span>Received</span>
          <span>Scheduled</span>
          <span>Tech</span>
        </div>
        {jobs.isLoading ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">Loading calls…</p>
        ) : rows.length === 0 ? (
          <div className="px-4 py-8">
            <p className="text-sm text-muted-foreground">
              {notLoadedText(jobs, "tickets") ??
                (q.trim() || tech || urgency || Object.keys(filters).length
                ? "Nothing matches this search."
                : view === "active"
                  ? "No open tickets."
                  : "Nothing in this view.")}
            </p>
            {!q.trim() && !tech && !urgency && !Object.keys(filters).length && view === "active" ? (
              <Button type="button" size="sm" className="mt-3" onClick={() => setCreate(true)}>
                <Plus className="size-4" />
                New call
              </Button>
            ) : null}
          </div>
        ) : (
          <ul>
            {rows.map((j) => (
              <JobRow key={j.id} job={j} billing={billingById.get(j.id)} onOpen={() => openFromList(j.id)} />
            ))}
          </ul>
        )}
        </div>
      </div>

      <JobSheet id={openId} initialTab={openTab} onClose={() => {
          setOpenId(null);
          back();
        }} />
      <NewJobDialog
        kind={kind}
        open={create}
        onOpenChange={setCreate}
        onCreated={openFromList}
      />
    </div>
  );
}

/** Tech and urgency pick-lists: side by side, half the row each, on a phone; 160px from sm up. */
const HALF_ROW_ON_PHONE = "w-40 max-sm:w-auto max-sm:min-w-0 max-sm:grow max-sm:basis-[calc(50%-0.25rem)]";

/**
 * One ticket. xl: a table row. Below xl the columns stack, except on a phone, where the chips, dates and tech
 * flow along one or two lines under the account so a row stays short.
 */
function JobRow({ job, billing, onOpen }: { job: ServiceJob; billing?: TicketBillingRow; onOpen: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="desk-flat grid w-full gap-1 border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-muted/60 max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-2.5 max-sm:gap-y-1 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_5.5rem_8.5rem_4.5rem_4.5rem_7rem] xl:items-center xl:gap-3"
      >
        <span className="max-sm:w-full">
          <span className="block font-medium">
            {/* A blank customer reads "Untitled" on phones only; sm and up keep the blank line they had. */}
            {job.customer?.trim() ? job.customer : job.customer == null ? "Untitled" : <span className="sm:hidden">Untitled</span>}{" "}
            <AkBadge on={job.aviKatz} className="ml-1 align-middle" />
          </span>
          <AddressLine customer={job.customer} />

          <span className="text-xs text-muted-foreground max-sm:block">
            {job.callId}
            {job.wo ? ` · ${job.wo}` : ""}
            {job.issue ? ` · ${job.issue}` : ""}
          </span>
          {job.equipment ? (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {job.equipment.replace(/\r?\n/g, " · ")}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap gap-1 max-sm:contents">
          <DuplicateBadge duplicateOf={job.duplicateOf} siblingCount={job.siblings?.length ?? 0} />
          <FlagBadge flag={job.flag} />
          <DoubleBillBadge on={billing?.doubleBill} />
          <span className="xl:hidden">
            <UrgencyBadge urgency={job.urgency} />
          </span>
        </span>
        <span className="hidden xl:block">
          <UrgencyBadge urgency={job.urgency} />
        </span>
        <StatusBadge status={job.status} />
        {/* Phones: the dates and tech start their own line under the chips. Not rendered from sm up. */}
        <span aria-hidden className="hidden max-sm:block max-sm:h-0 max-sm:basis-full" />
        {/* Below xl the columns stack, so the bare dates need their labels. */}
        <span className="tabular text-sm text-muted-foreground">
          <span className="xl:hidden">Received </span>
          {formatShortDate(job.received)}
        </span>
        <span className="tabular text-sm text-muted-foreground">
          <span className="xl:hidden">Scheduled </span>
          {formatShortDate(job.scheduled)}
        </span>
        <span className="min-w-0 truncate text-sm">
          <span className="text-muted-foreground xl:hidden">Tech </span>
          <TechName name={job.technician} />
          {job.secondaryTech ? (
            <span className="text-muted-foreground" data-testid="job-secondary-tech">
              {" + "}
              <TechName name={job.secondaryTech} />
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
