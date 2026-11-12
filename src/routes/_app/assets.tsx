import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, MapPinOff, X } from "lucide-react";
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
import { useFromHere } from "@/lib/ops/search-params";

type View = "list" | "map";
type AssetsSearch = { view?: "map" };

export const Route = createFileRoute("/_app/assets")({
  validateSearch: (s: Record<string, unknown>): AssetsSearch => (s.view === "map" ? { view: "map" } : {}),
  component: Page,
});

/** Assets → In the Field (Chuy, 11/12): every machine at a customer, as a list or on the map. */
function Page() {
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
      <header>
        <h1 className="font-display text-3xl font-medium tracking-tight">Assets</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every machine at a customer: what it is, where it is, who owns it and what shape it's in. Filter the list, see it
          on the map, or export it.
        </p>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Assets section" data-testid="assets-sections">
          <FilterChip selected data-testid="assets-section-field">
            In the Field
          </FilterChip>
        </div>
      </header>

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
