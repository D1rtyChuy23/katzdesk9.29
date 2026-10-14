import { Fragment, useDeferredValue, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { MapPinOff, Navigation, RotateCcw, Store, X } from "lucide-react";
import { DeskMap, type MapPin } from "./desk-map";
import { needsAttention, openWork, pointOf, useGeoIndex } from "./geo-data";
import { FilterChip } from "./desk-charts";
import { ListToolbar, ToolbarSearch, TOOLBAR_SELECT } from "./list-toolbar";
import { RepFilter, RepName } from "./rep-select";
import { AkBadge, NoRepFlag } from "./ak-badge";
import { ShowMoreButton, useShowMore } from "./show-more";
import { useMyView } from "./my-view-bar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/separator";
import { canDriveTo, directionsUrl, NO_REP_COLOR, type LatLng, type PinQuality } from "@/lib/ops/geo";
import type { AccountGeo } from "@/lib/ops/geo-api";
import { formatLongDate } from "@/lib/ops/clock";
import { cn } from "@/lib/utils";

type ColorBy = "rep" | "work" | "pms";

const COLOR_BY: { id: ColorBy; label: string }[] = [
  { id: "rep", label: "Rep" },
  { id: "work", label: "Open Work" },
  { id: "pms", label: "PMs Due" },
];

/** Pin colors for the work and PM modes (rep colors come from the shared palette). */
const RED = "#b3261e";
const AMBER = "#a3580b";
const BLUE = "#2563eb";
const GRAY = "#a8a29e";

const MAP_HEIGHT = "h-[55vh] min-h-72 lg:h-[calc(100vh-14rem)] lg:min-h-[28rem]";
const LIST_STEP = 50;

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

/** Something on the account is late: a ticket past its date or a PM past due. */
const isPastDue = (a: AccountGeo) => a.pastDueCalls > 0 || a.pmsPastDue > 0;

/** List order: past due first, then anything needing attention, then the rest; by name within each. */
const attentionRank = (a: AccountGeo) => (isPastDue(a) ? 0 : needsAttention(a) ? 1 : 2);

/** Work mode: 2 = past due (red), 1 = open work or PM due soon (amber), 0 = nothing open (gray). */
function workTone(a: AccountGeo): 0 | 1 | 2 {
  if (isPastDue(a)) return 2;
  if (openWork(a) > 0 || a.pmsDueSoon > 0) return 1;
  return 0;
}

/** PM mode: 3 = PM past due, 2 = due soon, 1 = open PM later or with no date, 0 = no open PM. */
function pmTone(a: AccountGeo): 0 | 1 | 2 | 3 {
  if (a.pmsPastDue > 0) return 3;
  if (a.pmsDueSoon > 0) return 2;
  if (a.openPms > 0) return 1;
  return 0;
}

const WORK_COLOR = [GRAY, AMBER, RED] as const;
const PM_COLOR = [GRAY, BLUE, AMBER, RED] as const;

/** Pin color for an account, and a draw rank so the pins that matter sit on top. */
function paint(a: AccountGeo, mode: ColorBy, colorOf: (rep: string | null) => string): { color: string; rank: number } {
  if (mode === "work") {
    const t = workTone(a);
    return { color: WORK_COLOR[t], rank: t };
  }
  if (mode === "pms") {
    const t = pmTone(a);
    return { color: PM_COLOR[t], rank: t };
  }
  return a.rep ? { color: colorOf(a.rep), rank: 1 } : { color: NO_REP_COLOR, rank: 0 };
}

const KEEP_UPPER = new Set(["N", "S", "E", "W", "NE", "NW", "SE", "SW", "FM", "US", "SH", "IH", "CR", "PO"]);

/** The geocoder's upper-case match ("4444 WESTHEIMER RD, HOUSTON, TX, 77027") in normal case. */
function properCase(address: string): string {
  return address
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      /^[A-Z]{2}$/.test(part)
        ? part
        : part
            .toLowerCase()
            .replace(/\b[a-z][a-z'’]*/g, (w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
            .replace(/\bMc([a-z])/g, (_, c: string) => `Mc${c.toUpperCase()}`),
    )
    .join(", ");
}

/** The address to show: the typed one, else the geocoder's match. */
function shownAddress(a: AccountGeo): string | null {
  if (a.address) return a.address;
  return a.geocodeAddress ? properCase(a.geocodeAddress) : null;
}

const QUALITY_LABEL: Record<PinQuality, string> = {
  exact: "Exact pin",
  close: "Close match, check the pin",
  approx: "ZIP area (approximate)",
};

/** A legend dot or a list-row dot. Hollow = approximate (ZIP area) pin, like on the map. */
export function Swatch({ color, hollow, className }: { color: string; hollow?: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={hollow ? { border: `2px dashed ${color}` } : { backgroundColor: color }}
    />
  );
}

export type LegendItem = { key: string; label: string; color: string; hollow?: boolean; count?: number };

/** The map key: one dot per color in use, with how many pins carry it. */
export function MapLegend({ items, className, testId = "map-legend" }: { items: LegendItem[]; className?: string; testId?: string }) {
  if (!items.length) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground", className)} aria-label="Map key" data-testid={testId}>
      {items.map((i) => (
        <li key={i.key} className="flex items-center gap-1.5">
          <Swatch color={i.color} hollow={i.hollow} />
          <span>{i.label}</span>
          {i.count != null ? <span className="tabular font-medium text-foreground">{i.count.toLocaleString("en-US")}</span> : null}
        </li>
      ))}
    </ul>
  );
}

/** Short work summary for a list row ("2 past due · 5 open"), with its tone. */
function rowWork(a: AccountGeo): { text: string; tone: "danger" | "warn" } | null {
  const late = a.pastDueCalls + a.pmsPastDue;
  const open = openWork(a);
  const bits = [
    late ? `${late} past due` : null,
    a.pmsDueSoon ? plural(a.pmsDueSoon, "PM due soon", "PMs due soon") : null,
    open ? `${open} open` : null,
  ].filter(Boolean);
  if (!bits.length) return null;
  return { text: bits.join(" · "), tone: late ? "danger" : "warn" };
}

/**
 * The Accounts tab of the Map page: every account with a pin, colored by rep, open work or PMs due, with a side
 * panel that shows the picked account and a list of the filtered accounts (needs attention first).
 */
export function CustomerMap() {
  const geo = useGeoIndex();
  const { filterMine, matchMine, role } = useMyView();
  const scoped = filterMine && role === "sales";

  const [q, setQ] = useState("");
  const needle = useDeferredValue(q.trim().toLowerCase());
  const [colorBy, setColorBy] = useState<ColorBy>("rep");
  const [rep, setRep] = useState("");
  const [attention, setAttention] = useState(false);
  const [showApprox, setShowApprox] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [focus, setFocus] = useState<LatLng | null>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const panelBox = useRef<HTMLElement>(null);

  const { accounts, byId, colorOf } = geo;
  const data = geo.data;

  // Filters that decide which accounts are in play (the list and the pins). Color mode is not one of them.
  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (scoped && !(a.aviKatz || matchMine(a.rep))) return false;
      if (rep === "__none__" ? !!a.rep : rep && a.rep !== rep) return false;
      if (attention && !needsAttention(a)) return false;
      if (needle && !a.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [accounts, scoped, matchMine, rep, attention, needle]);

  const counts = useMemo(() => {
    let pinned = 0;
    let approx = 0;
    for (const a of filtered) {
      if (a.lat == null || a.lng == null) continue;
      pinned += 1;
      if (a.quality === "approx") approx += 1;
    }
    return { pinned, approx, noPin: filtered.length - pinned };
  }, [filtered]);

  // Pins: rebuilt only when the filtered set, the color mode or the ZIP toggle changes (not on selection).
  const basePins = useMemo(() => {
    const out: (MapPin & { rank: number })[] = [];
    for (const a of filtered) {
      const p = pointOf(a);
      if (!p) continue;
      const approx = a.quality === "approx";
      if (approx && !showApprox) continue;
      const { color, rank } = paint(a, colorBy, colorOf);
      out.push({
        id: a.id,
        lat: p.lat,
        lng: p.lng,
        color,
        rank,
        hollow: approx,
        size: rank === 0 && colorBy !== "rep" ? 5 : 6,
        title: `${a.name}${a.city ? ` · ${a.city}` : ""}${approx ? " · ZIP area (approximate)" : ""}`,
      });
    }
    // Lower ranks first so red / amber pins draw over gray ones.
    out.sort((x, y) => x.rank - y.rank);
    return out;
  }, [filtered, colorBy, colorOf, showApprox]);

  const selected = selectedId != null ? byId.get(selectedId) ?? null : null;

  // The picked account always shows on the map, even when the ZIP area pins are hidden or a filter left it out.
  const pins = useMemo(() => {
    if (!selected || basePins.some((p) => p.id === selected.id)) return basePins;
    const p = pointOf(selected);
    if (!p) return basePins;
    const { color } = paint(selected, colorBy, colorOf);
    return [...basePins, { id: selected.id, lat: p.lat, lng: p.lng, color, hollow: selected.quality === "approx", title: selected.name }];
  }, [basePins, selected, colorBy, colorOf]);

  const legend = useMemo<LegendItem[]>(() => {
    const items: LegendItem[] = [];
    if (!basePins.length) return items;
    if (colorBy === "rep") {
      const byRep = new Map<string, number>();
      let none = 0;
      for (const p of basePins) {
        const a = byId.get(Number(p.id));
        if (!a) continue;
        if (a.rep) byRep.set(a.rep, (byRep.get(a.rep) ?? 0) + 1);
        else none += 1;
      }
      for (const [name, count] of [...byRep.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
        items.push({ key: `rep-${name}`, label: name, color: colorOf(name), count });
      }
      if (none) items.push({ key: "rep-none", label: "No rep", color: NO_REP_COLOR, count: none });
    } else {
      const tones = colorBy === "work" ? [0, 0, 0] : [0, 0, 0, 0];
      for (const p of basePins) tones[p.rank] = (tones[p.rank] ?? 0) + 1;
      const labels =
        colorBy === "work"
          ? ["Nothing open", "Open work or PM due soon", "Past due"]
          : ["No open PM", "Open PM, later or no date", `PM due within ${data?.dueDays ?? 14} days`, "PM past due"];
      const colors = colorBy === "work" ? WORK_COLOR : PM_COLOR;
      for (let i = labels.length - 1; i >= 0; i--) items.push({ key: `tone-${i}`, label: labels[i]!, color: colors[i]!, count: tones[i] ?? 0 });
    }
    if (showApprox && counts.approx) items.push({ key: "approx", label: "Hollow: ZIP area (approximate)", color: "var(--color-muted-foreground)", hollow: true });
    return items;
  }, [basePins, byId, colorBy, colorOf, counts.approx, data?.dueDays, showApprox]);

  // The list: needs attention first (past due first), then by name.
  const list = useMemo(
    () => [...filtered].sort((a, b) => attentionRank(a) - attentionRank(b) || collator.compare(a.name, b.name) || a.id - b.id),
    [filtered],
  );
  const filterKey = `${needle}|${rep}|${attention}|${scoped}`;
  const paged = useShowMore(list, filterKey, LIST_STEP);

  const anyFilter = !!needle || !!rep || attention;
  const clearFilters = () => {
    setQ("");
    setRep("");
    setAttention(false);
  };

  function pick(a: AccountGeo, fromList: boolean) {
    setSelectedId(a.id);
    const p = pointOf(a);
    if (!fromList || !p) return;
    // A new focus object pans the map, so tapping the same row again brings the account back after the map moved.
    setFocus({ lat: p.lat, lng: p.lng });
    // On a phone the list sits under the map: bring the map back into view.
    if (window.matchMedia("(max-width: 1023px)").matches) mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // No data yet: loading (also what the server renders, so the first client render matches it).
  if (!data && !geo.isError) {
    return (
      <div className="mt-5" data-testid="customer-map-loading">
        <p className="text-sm text-muted-foreground">Loading the map…</p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row">
          <Skeleton className={cn("min-w-0 lg:flex-1", MAP_HEIGHT)} />
          <Skeleton className="h-64 lg:h-[calc(100vh-14rem)] lg:min-h-[28rem] lg:w-96" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-5 rounded-lg border border-border bg-card p-4 text-sm" role="alert" data-testid="customer-map-error">
        <p className="font-medium text-destructive">Could not load the map.</p>
        <p className="mt-1 text-muted-foreground">{geo.error instanceof Error ? geo.error.message : "Something went wrong while loading the accounts."}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void geo.refetch()}>
          <RotateCcw />
          Try Again
        </Button>
      </div>
    );
  }

  const nothingPinned = accounts.every((a) => a.lat == null || a.lng == null);
  const importNote = counts.noPin ? "More can be placed by importing the verified locations file (Customers → Import → Locations)." : null;

  return (
    <div data-testid="customer-map">
      <ListToolbar>
        <ToolbarSearch value={q} onChange={setQ} placeholder="Search accounts…" testId="map-search" />
        <RepFilter value={rep} onChange={setRep} extraNames={data.reps} className={TOOLBAR_SELECT} />
        <FilterChip selected={attention} onClick={() => setAttention((v) => !v)} data-testid="map-attention">
          Needs Attention
        </FilterChip>
        <FilterChip
          selected={showApprox}
          onClick={() => setShowApprox((v) => !v)}
          title="Accounts placed only at the center of their ZIP code, drawn as hollow pins"
          data-testid="map-approx"
        >
          ZIP Area Pins
        </FilterChip>
      </ListToolbar>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Color by">
        <span className="mr-1 text-xs font-medium text-muted-foreground">Color By</span>
        {COLOR_BY.map((c) => (
          <FilterChip key={c.id} selected={colorBy === c.id} onClick={() => setColorBy(c.id)} data-testid={`map-color-${c.id}`}>
            {c.label}
          </FilterChip>
        ))}
      </div>

      {/* Counts and key sit above the map on a wide screen; on a phone the key and the import note move under it. */}
      <div className="mt-4 space-y-2">
        <p className="text-xs text-muted-foreground" data-testid="map-counts">
          <span className="font-medium text-foreground">{plural(showApprox ? counts.pinned : counts.pinned - counts.approx, "account")} on the map</span>
          {" · "}
          {counts.noPin.toLocaleString("en-US")} without a pin
          {!showApprox && counts.approx ? ` · ${plural(counts.approx, "ZIP area pin")} hidden` : ""}
          {importNote ? <span className="hidden lg:inline"> · {importNote}</span> : null}
        </p>
        <MapLegend items={legend} className="hidden lg:flex" />
      </div>

      <div className="mt-3 flex flex-col gap-4 lg:flex-row">
        <div ref={mapBox} className="min-w-0 scroll-mt-32 lg:flex-1 lg:scroll-mt-20">
          <DeskMap
            pins={pins}
            selectedId={selectedId}
            onPinClick={(pin) => {
              const a = byId.get(Number(pin.id));
              if (a) pick(a, false);
            }}
            fitKey={`${filterKey}|${data.accounts.length}`}
            focus={focus}
            className={MAP_HEIGHT}
            label="Customer map"
          >
            {basePins.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
                <p className="max-w-xs rounded-lg border border-border bg-card/95 px-4 py-3 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
                  {nothingPinned
                    ? "No account has a map pin yet. Import the verified locations file from Customers → Import → Locations."
                    : filtered.length === 0
                      ? "No accounts match these filters."
                      : !showApprox && counts.approx
                        ? "These accounts only have ZIP area pins, which are hidden. Turn on ZIP Area Pins to see them."
                        : "None of these accounts has a pin to show."}
                </p>
              </div>
            ) : null}
            {selected ? (
              // Phone only: the details card is under the map, so say which account is picked and offer a way down.
              <div className="absolute right-2 bottom-7 left-2 z-10 flex items-center gap-2 rounded-lg border border-border bg-card/95 py-1.5 pr-1.5 pl-3 shadow-[var(--shadow-soft)] lg:hidden">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{selected.name}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 px-3"
                  onClick={() => panelBox.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  data-testid="map-details-jump"
                >
                  Details
                </Button>
              </div>
            ) : null}
          </DeskMap>
          <div className="mt-2 space-y-1.5 lg:hidden">
            <MapLegend items={legend} testId="map-legend-below" />
            {importNote ? <p className="text-xs text-muted-foreground">{importNote}</p> : null}
          </div>
        </div>

        <aside
          ref={panelBox}
          className="flex min-w-0 scroll-mt-32 flex-col overflow-hidden rounded-lg border border-border bg-card lg:h-[calc(100vh-14rem)] lg:min-h-[28rem] lg:w-96 lg:shrink-0 lg:scroll-mt-20"
          aria-label="Accounts on the map"
          data-testid="map-panel"
        >
          {selected ? (
            <AccountCard account={selected} scoped={data.scoped} onClose={() => setSelectedId(null)} />
          ) : (
            <p className="border-b border-border px-4 py-3 text-xs text-muted-foreground">Tap a pin or an account below to see its details.</p>
          )}

          <div className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
            <h2 className="text-sm font-medium">{plural(filtered.length, "account")}</h2>
            <span className="text-[11px] text-muted-foreground">Needs attention first</span>
          </div>

          <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
            {list.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground" data-testid="map-empty">
                <p>{accounts.length === 0 ? "There are no accounts yet." : "No accounts match these filters."}</p>
                {anyFilter ? (
                  <Button type="button" variant="outline" className="mt-3" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul>
                {paged.visible.map((a) => (
                  <AccountRow key={a.id} account={a} color={paint(a, colorBy, colorOf).color} selected={a.id === selectedId} onPick={() => pick(a, true)} />
                ))}
                <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} label="accounts" />
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function AccountRow({ account: a, color, selected, onPick }: { account: AccountGeo; color: string; selected: boolean; onPick: () => void }) {
  const hasPin = a.lat != null && a.lng != null;
  const work = rowWork(a);
  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onPick}
        aria-current={selected ? "true" : undefined}
        className={cn("desk-flat flex min-h-11 w-full items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted/60", selected && "bg-muted")}
        data-testid="map-account-row"
      >
        {hasPin ? <Swatch color={color} hollow={a.quality === "approx"} className="mt-1.5" /> : <MapPinOff className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">
            {a.name}
            <AkBadge on={a.aviKatz} className="ml-1.5 align-middle" />
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {a.city ?? "No city"}
            {" · "}
            {a.rep ? <RepName name={a.rep} /> : <NoRepFlag show />}
          </span>
          {work ? <span className={cn("block truncate text-xs", work.tone === "danger" ? "text-destructive" : "text-warning")}>{work.text}</span> : null}
        </span>
        {!hasPin ? (
          <Badge variant="outline" size="tight" className="mt-0.5">
            No pin
          </Badge>
        ) : null}
      </button>
    </li>
  );
}

/** The picked account: who, where, how good the pin is, what is open, and the two ways out. */
function AccountCard({ account: a, scoped, onClose }: { account: AccountGeo; scoped: boolean; onClose: () => void }) {
  const point = pointOf(a);
  const address = shownAddress(a);
  const url = directionsUrl({ point, quality: a.quality, address: a.address });
  const drivablePin = !!point && canDriveTo(a.quality);
  const directionsNote = !url
    ? a.quality === "approx"
      ? "No directions: there is no street address on file and the pin is only the ZIP area."
      : "No directions: there is no street address on file."
    : !drivablePin && a.quality === "approx"
      ? "Directions use the typed address, not the ZIP area pin."
      : null;
  const lines = workLines(a);
  return (
    <section className="shrink-0 border-b border-border p-4" aria-label={`Selected account: ${a.name}`} data-testid="map-account-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base leading-snug font-medium">
            {a.name}
            <AkBadge on={a.aviKatz} className="ml-1.5 align-middle" />
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{a.rep ? <RepName name={a.rep} /> : <NoRepFlag show />}</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="-mt-1.5 -mr-2 size-9" onClick={onClose} aria-label="Close account details">
          <X />
        </Button>
      </div>

      <p className={cn("mt-2 text-sm", !address && "text-muted-foreground")}>{address ?? "No address"}</p>
      <p className={cn("text-xs", a.quality === "close" ? "text-warning" : "text-muted-foreground")} data-testid="map-pin-quality">
        {a.quality ? QUALITY_LABEL[a.quality] : point ? "Pin placed, match not recorded" : "No pin yet"}
      </p>

      <ul className="mt-3 space-y-0.5 text-xs">
        {lines.length ? lines.map((l, i) => <li key={i}>{l}</li>) : <li className="text-muted-foreground">No open work.</li>}
      </ul>
      {scoped ? <p className="mt-1 text-[11px] text-muted-foreground">Work counts cover your own accounts only.</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild size="sm" className="h-9 px-3">
          <Link to="/customers" search={{ open: a.id }} data-testid="map-open-account">
            <Store />
            Open Account
          </Link>
        </Button>
        {url ? (
          <Button asChild size="sm" variant="outline" className="h-9 px-3">
            <a href={url} target="_blank" rel="noreferrer" data-testid="map-directions">
              <Navigation />
              Directions
            </a>
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" className="h-9 px-3" disabled title={directionsNote ?? undefined} data-testid="map-directions">
            <Navigation />
            Directions
          </Button>
        )}
      </div>
      {directionsNote ? <p className="mt-1.5 text-[11px] text-muted-foreground">{directionsNote}</p> : null}
    </section>
  );
}

/** Parts of one line, separated by a muted dot. */
function joined(parts: ReactNode[]): ReactNode {
  return parts.map((part, i) => (
    <Fragment key={i}>
      {i ? <span className="text-muted-foreground"> · </span> : null}
      {part}
    </Fragment>
  ));
}

/**
 * One line per kind of open work, with the late and due-soon parts called out. Tickets and TLCs share a line because
 * the past-due count covers both (same rule as the past-due flag on the Tickets and TLC pages).
 */
function workLines(a: AccountGeo): ReactNode[] {
  const out: ReactNode[] = [];
  const late = (n: number) => <span className="font-medium text-destructive">{n} past due</span>;
  const calls: ReactNode[] = [];
  if (a.openCalls) calls.push(plural(a.openCalls, "open ticket"));
  if (a.openTlcs) calls.push(plural(a.openTlcs, "open TLC"));
  if (a.pastDueCalls) calls.push(late(a.pastDueCalls));
  if (calls.length) out.push(joined(calls));
  if (a.openPms) {
    out.push(
      joined(
        [
          plural(a.openPms, "open PM"),
          a.pmsPastDue ? late(a.pmsPastDue) : null,
          a.pmsDueSoon ? <span className="font-medium text-warning">{a.pmsDueSoon} due soon</span> : null,
          a.nextPm ? `next ${formatLongDate(a.nextPm)}` : null,
          a.pmsNoDate ? `${a.pmsNoDate} with no date` : null,
        ].filter((x) => x != null),
      ),
    );
  }
  if (a.openInstalls) {
    out.push(joined([plural(a.openInstalls, "open install"), a.nextInstall ? `next ${formatLongDate(a.nextInstall)}` : null].filter((x) => x != null)));
  }
  return out;
}
