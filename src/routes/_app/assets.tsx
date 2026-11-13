import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, MapPinOff, Warehouse as WarehouseIcon, Wrench, X } from "lucide-react";
import { FilterChip } from "@/components/desk/desk-charts";
import { DeskMap, type MapPin } from "@/components/desk/desk-map";
import { downloadCsv } from "@/components/desk/download-csv";
import { nameKey, pointOf, useGeoIndex } from "@/components/desk/geo-data";
import { ListToolbar, ToolbarNote, ToolbarSearch, ToolbarSelect } from "@/components/desk/list-toolbar";
import { RepFilter } from "@/components/desk/rep-select";
import { ShowMoreButton, useShowMore } from "@/components/desk/show-more";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/separator";
import { formatLongDate } from "@/lib/ops/clock";
import {
  byAccount,
  countBy,
  fieldAssetsCsv,
  filterFieldAssets,
  NOT_SET,
  type FieldAsset,
  type FieldFilters,
} from "@/lib/ops/field-assets";
import { FIELD_ASSETS_KEY, listFieldAssets } from "@/lib/ops/field-assets-api";
import { getMyAccess } from "@/lib/ops/access";
import { useFromHere } from "@/lib/ops/search-params";
import { byModel, filterStock, isFree, placeLabel, type StockUnit } from "@/lib/ops/warehouse-assets";
import { listWarehouseAssets, WAREHOUSE_ASSETS_KEY } from "@/lib/ops/warehouse-assets-api";

type View = "list" | "map";
type Section = "field" | "warehouse";
type AssetsSearch = { view?: "map"; section?: "warehouse" };

export const Route = createFileRoute("/_app/assets")({
  validateSearch: (s: Record<string, unknown>): AssetsSearch => ({
    ...(s.view === "map" ? { view: "map" as const } : {}),
    ...(s.section === "warehouse" ? { section: "warehouse" as const } : {}),
  }),
  component: Page,
});

/**
 * Assets (Chuy, 11/12): In the Field, every machine at a customer, and Warehouse, what the barn has to put out and the
 * refurbs on their way. The Warehouse role sees the Warehouse section only.
 */
function Page() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const access = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess(), staleTime: 60_000 });
  const warehouseOnly = access.data?.role === "warehouse" && !access.data?.isAdmin;
  const section: Section = warehouseOnly || search.section === "warehouse" ? "warehouse" : "field";
  const setSection = (next: Section) =>
    void navigate({ search: next === "warehouse" ? { section: "warehouse" } : {}, replace: true, resetScroll: false });
  return (
    <div>
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Assets</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {section === "field"
            ? "Every machine at a customer: what it is, where it is, who owns it and what shape it's in. Filter the list, see it on the map, or export it."
            : "What the barn has to put out at a customer, what came back from a refurb and waits in staging, and the refurbs still open. Open a unit to place or move it on the Warehouse page."}
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Assets section" data-testid="assets-sections">
          {warehouseOnly ? null : (
            <FilterChip selected={section === "field"} onClick={() => setSection("field")} data-testid="assets-section-field">
              In the Field
            </FilterChip>
          )}
          <FilterChip selected={section === "warehouse"} onClick={() => setSection("warehouse")} data-testid="assets-section-warehouse">
            Warehouse
          </FilterChip>
        </div>
      </header>
      {section === "warehouse" ? <WarehouseSection /> : access.isLoading ? <Skeleton className="mt-4 h-64 w-full rounded-xl" /> : <FieldSection />}
    </div>
  );
}

/** Assets → In the Field (11/12): every machine at a customer, as a list or on the map. */
function FieldSection() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view: View = search.view ?? "list";
  const setView = (v: View) => void navigate({ search: v === "map" ? { view: "map" } : {}, replace: true, resetScroll: false });
  const q = useQuery({ queryKey: FIELD_ASSETS_KEY, queryFn: () => listFieldAssets(), staleTime: 60_000 });
  const geo = useGeoIndex();
  const [filters, setFilters] = useState<FieldFilters>({});
  const set = (patch: Partial<FieldFilters>) => setFilters((cur) => ({ ...cur, ...patch }));
  const repOf = (customer: string) => geo.byName.get(nameKey(customer))?.rep ?? null;
  const all = useMemo(() => q.data ?? [], [q.data]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- repOf reads the geo index, which geo.byName stands for
  const rows = useMemo(() => filterFieldAssets(all, filters, repOf), [all, filters, geo.byName]);
  const brands = useMemo(() => countBy(all, (r) => r.brand), [all]);
  const models = useMemo(() => countBy(filters.brand ? all.filter((r) => r.brand === filters.brand) : all, (r) => r.catalogModel), [all, filters.brand]);
  const ownerships = useMemo(() => countBy(all, (r) => r.ownership), [all]);
  const conditions = useMemo(() => countBy(all, (r) => r.condition), [all]);
  const accounts = useMemo(() => byAccount(rows), [rows]);
  const filtered = Object.values(filters).some(Boolean);
  // Reps and map pins come from the map's account list: until it is in, the rep filter, export and map wait for it.
  const geoReady = !geo.isLoading && !geo.isError;

  return (
    <div>
      <ListToolbar>
        <ToolbarSearch value={filters.q ?? ""} onChange={(v) => set({ q: v })} placeholder="Search account, model, serial, Part #…" label="Search machines" testId="assets-search" />
        <ToolbarSelect value={filters.brand ?? ""} onChange={(e) => set({ brand: e.target.value, model: "" })} allowEmpty emptyLabel="All brands" aria-label="Filter by brand">
          {brands.map(([b, n]) => (
            <option key={b} value={b}>{`${b} (${n})`}</option>
          ))}
        </ToolbarSelect>
        <ToolbarSelect value={filters.model ?? ""} onChange={(e) => set({ model: e.target.value })} allowEmpty emptyLabel="All models" aria-label="Filter by model">
          {models.map(([m, n]) => (
            <option key={m} value={m}>{`${m} (${n})`}</option>
          ))}
        </ToolbarSelect>
        <ToolbarSelect value={filters.ownership ?? ""} onChange={(e) => set({ ownership: e.target.value })} allowEmpty emptyLabel="Any ownership" aria-label="Filter by ownership">
          {ownerships.map(([o, n]) => (
            <option key={o} value={o}>{`${o} (${n})`}</option>
          ))}
          <option value={NOT_SET}>Not set</option>
        </ToolbarSelect>
        <ToolbarSelect value={filters.condition ?? ""} onChange={(e) => set({ condition: e.target.value })} allowEmpty emptyLabel="Any condition" aria-label="Filter by condition">
          {conditions.map(([c, n]) => (
            <option key={c} value={c}>{`${c} (${n})`}</option>
          ))}
          <option value={NOT_SET}>Not set</option>
        </ToolbarSelect>
        <RepFilter
          value={filters.rep ?? ""}
          onChange={(v) => set({ rep: v })}
          extraNames={geo.data?.reps}
          className={`h-9 w-auto max-w-56 shrink-0 rounded-full pr-8 ${geoReady ? "" : "pointer-events-none opacity-50"}`}
        />
        {filtered ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => setFilters({})} data-testid="assets-clear">
            <X className="size-4" /> Clear
          </Button>
        ) : null}
        <ToolbarNote data-testid="assets-count">
          {q.isLoading ? "Loading…" : `${rows.length} machine${rows.length === 1 ? "" : "s"} at ${accounts.size} account${accounts.size === 1 ? "" : "s"}`}
        </ToolbarNote>
      </ListToolbar>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChip selected={view === "list"} onClick={() => setView("list")} data-testid="assets-view-list">
          List
        </FilterChip>
        <FilterChip selected={view === "map"} onClick={() => setView("map")} data-testid="assets-view-map">
          Map
        </FilterChip>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="ml-auto"
          disabled={!rows.length || !geoReady}
          // The byte-order mark makes Excel read accents right ("Café"), as the other exports do.
          onClick={() => downloadCsv(`KatzDesk-Assets-In-The-Field-${new Date().toISOString().slice(0, 10)}.csv`, `\uFEFF${fieldAssetsCsv(rows, repOf)}`)}
          data-testid="assets-export"
        >
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {geo.isError ? (
        <p className="mt-3 text-sm text-warning" data-testid="assets-geo-error">
          Reps and map pins couldn't load, so the rep filter, the map and the export's Rep column are off. Reload to try again.
        </p>
      ) : geo.isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading reps and map pins…</p>
      ) : null}
      {q.isError ? (
        <p className="mt-4 text-sm text-destructive">Could not load the machines: {q.error instanceof Error ? q.error.message : "try again"}.</p>
      ) : q.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full rounded-xl" />
      ) : view === "list" ? (
        <AssetList rows={rows} repOf={repOf} resetKey={filters} />
      ) : (
        <AssetMap accounts={accounts} geo={geo} fitKey={JSON.stringify(filters)} />
      )}
    </div>
  );
}

function AccountLink({ row, from }: { row: FieldAsset; from: string | undefined }) {
  if (row.customerId == null) return <span className="font-medium">{row.customer}</span>;
  return (
    <Link to="/customers" search={{ open: row.customerId, from }} className="font-medium hover:underline">
      {row.customer}
    </Link>
  );
}

function AssetList({ rows, repOf, resetKey }: { rows: FieldAsset[]; repOf: (c: string) => string | null; resetKey: unknown }) {
  const { visible, remaining, showMore } = useShowMore(rows, resetKey, 100);
  const from = useFromHere("/customers");
  if (!rows.length) return <p className="mt-6 text-sm text-muted-foreground">No machines match these filters.</p>;
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border" data-testid="assets-list">
      <table className="w-full text-left text-sm max-sm:block sm:min-w-[64rem]">
        <thead className="bg-card text-[11px] font-medium tracking-wide text-muted-foreground uppercase max-sm:hidden">
          <tr>
            <th className="px-3 py-2">Account</th>
            <th className="px-3 py-2">Machine</th>
            <th className="px-3 py-2">Serial · Part #</th>
            <th className="px-3 py-2">Ownership</th>
            <th className="px-3 py-2">Installed</th>
            <th className="px-3 py-2">Condition</th>
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {visible.map((r) => (
            <tr key={r.id} className="border-t border-border align-top max-sm:block max-sm:p-3 max-sm:first:border-t-0" data-testid="assets-row">
              <td className="px-3 py-2 max-sm:block max-sm:p-0">
                <AccountLink row={r} from={from} />
                {r.accountRemoved ? <span className="ml-2 text-[11px] text-warning">Account removed</span> : null}
                <span className="block text-xs text-muted-foreground">{[r.address, repOf(r.customer)].filter(Boolean).join(" · ") || "No address"}</span>
              </td>
              <td className="px-3 py-2 max-sm:block max-sm:p-0 max-sm:pt-1">
                <span className="font-medium">{r.catalogModel}</span>
                {r.equipmentName && r.equipmentName !== r.catalogModel ? <span className="block text-xs text-muted-foreground">{r.equipmentName}</span> : null}
              </td>
              <td className="px-3 py-2 max-sm:inline-block max-sm:p-0 max-sm:pt-1 max-sm:pr-3">
                {r.serial ? `SN ${r.serial}` : "No serial"}
                {r.partNumber ? <span className="block text-xs text-muted-foreground">Part # {r.partNumber}</span> : null}
              </td>
              <td className="px-3 py-2 max-sm:inline-block max-sm:p-0 max-sm:pt-1 max-sm:pr-3">{r.ownership || "—"}</td>
              <td className="px-3 py-2 whitespace-nowrap max-sm:inline-block max-sm:p-0 max-sm:pt-1 max-sm:pr-3">{r.installDate ? formatLongDate(r.installDate) : "—"}</td>
              <td className="px-3 py-2 max-sm:inline-block max-sm:p-0 max-sm:pt-1">{r.condition || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ShowMoreButton remaining={remaining} onClick={showMore} label="machines" />
    </div>
  );
}

/** One pin per account with machines, colored by rep, sized and numbered by how many. A pin opens its machines. */
function AssetMap({ accounts, geo, fitKey }: { accounts: Map<string, FieldAsset[]>; geo: ReturnType<typeof useGeoIndex>; fitKey: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const from = useFromHere("/customers");
  const { pins, noPin } = useMemo(() => {
    const out: MapPin[] = [];
    let missing = 0;
    for (const [key, list] of accounts) {
      const a = geo.byName.get(key);
      const p = pointOf(a);
      if (!a || !p) {
        missing += list.length;
        continue;
      }
      out.push({
        id: key,
        lat: p.lat,
        lng: p.lng,
        color: geo.colorOf(a.rep),
        hollow: a.quality === "approx",
        size: Math.min(14, 6 + Math.ceil(Math.log2(list.length + 1)) * 2),
        label: list.length > 1 ? String(list.length) : undefined,
        title: `${list[0]!.customer}: ${list.length} machine${list.length === 1 ? "" : "s"}`,
      });
    }
    return { pins: out, noPin: missing };
  }, [accounts, geo]);
  const list = picked ? accounts.get(picked) ?? [] : [];
  return (
    <div className="mt-3" data-testid="assets-map">
      {noPin ? (
        <p className="mb-2 flex items-center gap-1 text-xs text-muted-foreground" data-testid="assets-no-pin">
          <MapPinOff className="size-3.5" /> {noPin} machine{noPin === 1 ? " is" : "s are"} at accounts with no map pin; they're in the list.
        </p>
      ) : null}
      <DeskMap pins={pins} selectedId={picked} onPinClick={(p) => setPicked(String(p.id))} fitKey={fitKey} label="Assets map" className="h-[60vh] min-h-80 rounded-xl" />
      {picked && list.length ? (
        <section className="mt-3 rounded-xl border border-border p-3" data-testid="assets-map-account">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <AccountLink row={list[0]!} from={from} />
            <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setPicked(null)}>
              Close
            </button>
          </div>
          <p className="text-xs text-muted-foreground">{list[0]!.address || "No address"}</p>
          <ul className="mt-2 grid gap-1 text-sm">
            {list.map((r) => (
              <li key={r.id}>
                <span className="font-medium">{r.catalogModel}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {[r.serial ? `SN ${r.serial}` : "No serial", r.ownership, r.condition].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

const KIND_LABEL: Record<string, string> = { equip: "Equipment", dispenser: "Dispensers", module: "Modules" };

/**
 * Assets → Warehouse (11/12): free stock on the racks (by model, then each unit), the staging area a completed refurb
 * fills, and the refurbs still open. Each unit opens on the Warehouse page at its rack slot, where it is placed or moved.
 */
function WarehouseSection() {
  const q = useQuery({ queryKey: WAREHOUSE_ASSETS_KEY, queryFn: () => listWarehouseAssets(), staleTime: 30_000 });
  const [text, setText] = useState("");
  const [kind, setKind] = useState("");
  const available = useMemo(() => filterStock(q.data?.available ?? [], text, kind), [q.data, text, kind]);
  const staging = useMemo(() => filterStock(q.data?.staging ?? [], text, kind), [q.data, text, kind]);
  const models = useMemo(() => byModel(available), [available]);
  const freeCount = available.filter(isFree).reduce((n, u) => n + (u.qty || 1), 0);
  const rebuilds = q.data?.rebuilds ?? [];
  if (q.isError) return <p className="mt-4 text-sm text-destructive">Could not load the warehouse: {q.error instanceof Error ? q.error.message : "try again"}.</p>;
  if (q.isLoading) return <Skeleton className="mt-4 h-64 w-full rounded-xl" />;
  return (
    <div data-testid="assets-warehouse">
      <ListToolbar>
        <ToolbarSearch value={text} onChange={setText} placeholder="Search model, serial, rack…" label="Search stock" testId="assets-warehouse-search" />
        <ToolbarSelect value={kind} onChange={(e) => setKind(e.target.value)} allowEmpty emptyLabel="All kinds" aria-label="Filter by kind">
          {Object.entries(KIND_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </ToolbarSelect>
        <ToolbarNote data-testid="assets-warehouse-count">{`${freeCount} free to put out · ${staging.length} in staging · ${rebuilds.length} open refurb${rebuilds.length === 1 ? "" : "s"}`}</ToolbarNote>
      </ListToolbar>

      <section className="mt-4" data-testid="assets-available">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <WarehouseIcon className="size-4" /> Available to put out
        </h2>
        {models.length ? (
          <ul className="mt-2 flex flex-wrap gap-2" data-testid="assets-available-models">
            {models.map((m) => (
              <li key={m.model}>
                {/* A model's chip lists just its units. */}
                <button
                  type="button"
                  onClick={() => setText(text.trim().toLowerCase() === m.model.toLowerCase() ? "" : m.model)}
                  className={`rounded-full border px-3 py-1 text-xs hover:bg-muted ${text.trim().toLowerCase() === m.model.toLowerCase() ? "border-foreground" : "border-border"}`}
                  aria-pressed={text.trim().toLowerCase() === m.model.toLowerCase()}
                >
                  <span className="font-medium">{m.model}</span> · {m.free} free{m.held ? ` · ${m.held} spoken for` : ""}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Nothing free on the racks matches.</p>
        )}
        <StockTable units={available} />
      </section>

      <section className="mt-6" data-testid="assets-staging">
        <h2 className="text-sm font-medium">Staging: back from a refurb, waiting for its shop test and a rack</h2>
        {staging.length ? <StockTable units={staging} /> : <p className="mt-2 text-sm text-muted-foreground">Nothing in staging.</p>}
      </section>

      <section className="mt-6" data-testid="assets-rebuilds">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Wrench className="size-4" /> Open refurbs
        </h2>
        {rebuilds.length ? (
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {rebuilds.map((r) => (
              <li key={r.id} className="rounded-xl border border-border p-3 text-sm" data-testid="assets-rebuild">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link to="/rebuilds" search={{ open: r.id }} className="font-medium hover:underline">
                    {r.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">{r.status}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {[r.account, r.targetComplete ? `Target ${formatLongDate(r.targetComplete)}` : "No target date"].join(" · ")}
                </p>
                {r.machines.length ? (
                  <ul className="mt-1 text-xs">
                    {r.machines.map((m, i) => (
                      <li key={`${m.model}-${m.serial ?? i}`}>
                        {m.model}
                        {m.serial ? ` · SN ${m.serial}` : ""}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">No open refurbs.</p>
        )}
      </section>
    </div>
  );
}

function StockTable({ units }: { units: StockUnit[] }) {
  const { visible, remaining, showMore } = useShowMore(units, units.length, 100);
  const from = useFromHere("/warehouse");
  if (!units.length) return null;
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-left text-sm max-sm:block sm:min-w-[48rem]">
        <thead className="bg-card text-[11px] font-medium tracking-wide text-muted-foreground uppercase max-sm:hidden">
          <tr>
            <th className="px-3 py-2">Model</th>
            <th className="px-3 py-2">Serial</th>
            <th className="px-3 py-2">Where</th>
            <th className="px-3 py-2">Shop test</th>
            <th className="px-3 py-2">Note</th>
          </tr>
        </thead>
        <tbody className="max-sm:block">
          {visible.map((u) => (
            <tr key={u.id} className="border-t border-border align-top max-sm:block max-sm:p-3" data-testid="assets-stock-row">
              <td className="px-3 py-2 max-sm:block max-sm:p-0">
                <Link to="/warehouse" search={{ open: u.id, from }} className="font-medium hover:underline">
                  {u.model}
                </Link>
                {u.qty > 1 ? <span className="ml-1 text-xs text-muted-foreground">× {u.qty}</span> : null}
              </td>
              <td className="px-3 py-2 max-sm:inline-block max-sm:p-0 max-sm:pr-3">{u.serial ? `SN ${u.serial}` : "No serial"}</td>
              <td className="px-3 py-2 max-sm:inline-block max-sm:p-0 max-sm:pr-3">{placeLabel(u)}</td>
              <td className="px-3 py-2 max-sm:inline-block max-sm:p-0 max-sm:pr-3">{u.shopTest === "needs-test" ? "Needs test" : u.shopTest ? "Tested" : "—"}</td>
              <td className="px-3 py-2 text-xs max-sm:block max-sm:p-0">
                {u.stockHold ? <span className="text-warning">{u.stockHold === "assign" ? `Assign requested${u.stockHoldCustomer ? ` for ${u.stockHoldCustomer}` : ""}` : "Remove requested"}</span> : null}
                {u.customerOwned ? <span className="block text-muted-foreground">Customer-owned: {u.customerOwned}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ShowMoreButton remaining={remaining} onClick={showMore} label="units" />
    </div>
  );
}
