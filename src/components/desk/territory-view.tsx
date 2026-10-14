import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, MapPinned, RotateCcw, Store, X } from "lucide-react";
import { DeskMap, type MapPin } from "./desk-map";
import { needsAttention, pointOf, useGeoIndex } from "./geo-data";
import { MapLegend, Swatch, type LegendItem } from "./customer-map";
import { RepName } from "./rep-select";
import { AkBadge, NoRepFlag } from "./ak-badge";
import { OpenLink } from "./open-link";
import { ShowMoreButton, useShowMore } from "./show-more";
import { useMyView } from "./my-view-bar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/separator";
import { groupByArea, isPoint, milesLabel, NO_REP_COLOR, spread, suggestRep, type Area, type LatLng } from "@/lib/ops/geo";
import type { AccountGeo } from "@/lib/ops/geo-api";
import { cn } from "@/lib/utils";

/** "Show On Map" for the accounts with no rep. */
const NONE = "__none__";
/** Everyone else's pins while one rep is shown. */
const FADED = "#a8a29e";
/** Pins this close to an area's center belong to it; a rep this close counts as nearby. */
const AREA_MILES = 5;

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });
const byName = (a: AccountGeo, b: AccountGeo) => collator.compare(a.name, b.name) || a.id - b.id;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
const hasPin = (a: AccountGeo) => a.lat != null && a.lng != null;

type RepCard = {
  rep: string;
  color: string;
  accounts: number;
  pinned: number;
  attention: number;
  /** Median miles from the center of the rep's pins; null with no pins. */
  medianMiles: number | null;
  cities: [string, number][];
};

function repCard(rep: string, color: string, list: AccountGeo[]): RepCard {
  const points: LatLng[] = [];
  const cities = new Map<string, number>();
  let attention = 0;
  for (const a of list) {
    const p = pointOf(a);
    if (p) points.push(p);
    if (needsAttention(a)) attention += 1;
    if (a.city) cities.set(a.city, (cities.get(a.city) ?? 0) + 1);
  }
  const s = spread(points);
  return {
    rep,
    color,
    accounts: list.length,
    pinned: points.length,
    attention,
    medianMiles: s ? s.medianMiles : null,
    cities: [...cities.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 3),
  };
}

type Suggestion = { rep: string; count: number; nearestMiles: number } | null;
type NoRepArea = Area<AccountGeo> & { suggestion: Suggestion };
type NoRepAreas = { areas: NoRepArea[]; unplaced: AccountGeo[] };

/**
 * Grouping ~2,600 accounts takes tens of milliseconds, more on a phone, so it runs once per data load, after the tab
 * has painted, and is kept (switching tabs does not redo it).
 */
const AREA_CACHE = new WeakMap<AccountGeo[], NoRepAreas>();

function buildNoRepAreas(accounts: AccountGeo[]): NoRepAreas {
  const noRep = accounts.filter((a) => !a.rep);
  const withRep = accounts.filter((a) => !!a.rep && hasPin(a));
  const { areas, unplaced } = groupByArea(noRep, pointOf, (a) => a.city, { radiusMiles: AREA_MILES, tieKey: (a) => a.name });
  return {
    areas: areas
      .map((area) => ({
        ...area,
        items: [...area.items].sort(byName),
        suggestion: suggestRep(area.center, withRep, pointOf, (a) => a.rep, AREA_MILES),
      }))
      .sort((x, y) => y.items.length - x.items.length || x.label.localeCompare(y.label)),
    unplaced: [...unplaced].sort(byName),
  };
}

/** The no-rep areas for this data load: null while they are being worked out (after the tab has painted). */
function useNoRepAreas(accounts: AccountGeo[] | null): NoRepAreas | null {
  const [, bump] = useState(0);
  useEffect(() => {
    if (!accounts || AREA_CACHE.has(accounts)) return;
    const t = window.setTimeout(() => {
      AREA_CACHE.set(accounts, buildNoRepAreas(accounts));
      bump((n) => n + 1);
    }, 30);
    return () => window.clearTimeout(t);
  }, [accounts]);
  return accounts ? AREA_CACHE.get(accounts) ?? null : null;
}

/**
 * The Territories tab of the Map page: one card per rep (accounts, pins, open work, how spread out, top cities) and
 * the accounts with no rep grouped by area, each with the rep who already covers that area best. The map shows one
 * rep's pins in color over everyone else's in gray.
 */
export function TerritoryView() {
  const geo = useGeoIndex();
  const { filterMine, matchMine, role } = useMyView();
  const scoped = filterMine && role === "sales";
  const { accounts, colorOf } = geo;
  const data = geo.data;

  const [shown, setShown] = useState<string | null>(null);
  const [pinId, setPinId] = useState<number | null>(null);
  // What the map fits to after the last Show On Map: an area's pins, or (null) the shown rep's pins. `n` changes on
  // every click so the same button fits again after the map has been moved.
  const [fit, setFit] = useState<{ n: number; points: LatLng[] | null }>({ n: 0, points: null });
  const [openAreas, setOpenAreas] = useState<Set<string>>(() => new Set());
  const mapBox = useRef<HTMLDivElement>(null);

  const inScope = useMemo(() => (scoped ? (a: AccountGeo) => a.aviKatz || matchMine(a.rep) : () => true), [scoped, matchMine]);

  // Rep cards follow My View like the Accounts tab.
  const cards = useMemo(() => {
    const byRep = new Map<string, AccountGeo[]>();
    for (const a of accounts) {
      if (!a.rep || !inScope(a)) continue;
      const list = byRep.get(a.rep);
      if (list) list.push(a);
      else byRep.set(a.rep, [a]);
    }
    const order = [...(data?.reps ?? [])];
    for (const r of byRep.keys()) if (!order.includes(r)) order.push(r);
    return order.filter((r) => byRep.has(r)).map((r) => repCard(r, colorOf(r), byRep.get(r)!));
  }, [accounts, inScope, data?.reps, colorOf]);

  // No rep is a coverage gap: shown in full for everyone, whatever My View says.
  const noRep = useMemo(() => {
    const list = accounts.filter((a) => !a.rep);
    return { total: list.length, pinned: list.filter(hasPin).length, attention: list.filter(needsAttention).length };
  }, [accounts]);
  const areas = useNoRepAreas(data?.accounts ?? null);
  const areaPage = useShowMore(areas?.areas ?? [], areas, 30);

  // Map: the accounts behind the cards plus every account with no rep.
  const { pins, legend, litPoints } = useMemo(() => {
    const lit = (a: AccountGeo) => (shown === NONE ? !a.rep : a.rep === shown);
    const out: (MapPin & { rank: number })[] = [];
    const litPoints: LatLng[] = [];
    const counts = new Map<string, number>();
    for (const a of accounts) {
      if (a.rep && !inScope(a)) continue;
      const p = pointOf(a);
      if (!p) continue;
      const approx = a.quality === "approx";
      const color = a.rep ? colorOf(a.rep) : NO_REP_COLOR;
      const title = `${a.name}${a.city ? ` · ${a.city}` : ""}${approx ? " · ZIP area (approximate)" : ""}`;
      if (!shown) {
        counts.set(a.rep ?? NONE, (counts.get(a.rep ?? NONE) ?? 0) + 1);
        out.push({ id: a.id, lat: p.lat, lng: p.lng, color, hollow: approx, size: 5, title, rank: a.rep ? 1 : 0 });
      } else if (lit(a)) {
        counts.set("lit", (counts.get("lit") ?? 0) + 1);
        litPoints.push(p);
        out.push({ id: a.id, lat: p.lat, lng: p.lng, color, hollow: approx, size: 6, title, rank: 1 });
      } else {
        counts.set("faded", (counts.get("faded") ?? 0) + 1);
        out.push({ id: a.id, lat: p.lat, lng: p.lng, color: FADED, size: 3, title, rank: 0 });
      }
    }
    out.sort((x, y) => x.rank - y.rank);
    const items: LegendItem[] = [];
    if (!shown) {
      for (const r of [...counts.keys()].filter((k) => k !== NONE).sort((x, y) => x.localeCompare(y))) {
        items.push({ key: r, label: r, color: colorOf(r), count: counts.get(r) });
      }
      if (counts.get(NONE)) items.push({ key: NONE, label: "No rep", color: NO_REP_COLOR, count: counts.get(NONE) });
    } else {
      items.push({ key: "lit", label: shown === NONE ? "No rep" : shown, color: shown === NONE ? NO_REP_COLOR : colorOf(shown), count: counts.get("lit") ?? 0 });
      if (counts.get("faded")) items.push({ key: "faded", label: "Everyone else", color: FADED, count: counts.get("faded") });
    }
    return { pins: out, legend: items, litPoints };
  }, [accounts, inScope, colorOf, shown]);

  const pinAccount = pinId != null ? geo.byId.get(pinId) ?? null : null;

  /** Light up one rep (or the accounts with no rep) and fit the map to them, or to `points` (one area) when given. */
  function showOnMap(rep: string, points?: LatLng[]) {
    setShown(rep);
    setPinId(null);
    setFit((f) => ({ n: f.n + 1, points: points?.length ? points : null }));
    mapBox.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function showAll() {
    setShown(null);
    setFit((f) => ({ n: f.n + 1, points: null }));
  }

  function toggleArea(key: string) {
    setOpenAreas((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!data && !geo.isError) {
    return (
      <div className="mt-5" data-testid="territory-loading">
        <p className="text-sm text-muted-foreground">Loading the map…</p>
        <Skeleton className="mt-3 h-[45vh] min-h-72 w-full" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-5 rounded-lg border border-border bg-card p-4 text-sm" role="alert" data-testid="territory-error">
        <p className="font-medium text-destructive">Could not load the territories.</p>
        <p className="mt-1 text-muted-foreground">{geo.error instanceof Error ? geo.error.message : "Something went wrong while loading the accounts."}</p>
        <Button type="button" variant="outline" className="mt-3" onClick={() => void geo.refetch()}>
          <RotateCcw />
          Try Again
        </Button>
      </div>
    );
  }

  if (!accounts.length) {
    return <p className="mt-5 rounded-lg border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">There are no accounts yet.</p>;
  }

  return (
    <div className="mt-5 space-y-8" data-testid="territory-view">
      <section aria-label="Territory map">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm">
            {shown ? (
              <>
                Showing <span className="font-medium">{shown === NONE ? "accounts with no rep" : shown}</span> over everyone else
              </>
            ) : (
              "Every territory, colored by rep"
            )}
          </p>
          {shown ? (
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={showAll} data-testid="territory-show-all">
              Show All Reps
            </Button>
          ) : null}
        </div>
        <MapLegend items={legend} className="mt-2" />
        <div ref={mapBox} className="mt-3 scroll-mt-20">
          <DeskMap
            pins={pins}
            selectedId={pinId}
            onPinClick={(pin) => setPinId(Number(pin.id))}
            fitKey={`territory|${fit.n}|${shown ?? "all"}|${data.accounts.length}|${scoped}`}
            fitTo={fit.points ?? (shown ? litPoints : null)}
            className="h-[45vh] min-h-72"
            label="Territory map"
          >
            {pins.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 grid place-items-center p-4">
                <p className="max-w-xs rounded-lg border border-border bg-card/95 px-4 py-3 text-center text-sm text-muted-foreground shadow-[var(--shadow-soft)]">
                  No account has a map pin yet. Import the verified locations file from Customers → Import → Locations.
                </p>
              </div>
            ) : null}
            {pinAccount ? <PinCard account={pinAccount} onClose={() => setPinId(null)} /> : null}
          </DeskMap>
        </div>
      </section>

      <section aria-labelledby="territory-reps">
        <h2 id="territory-reps" className="font-display text-xl">
          Reps
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {cards.length
            ? `${plural(cards.length, "rep")} with accounts${scoped ? " · your accounts only (My View)" : ""}.`
            : scoped
              ? "None of your accounts has a rep on the list yet."
              : "No account is assigned to a rep yet. Every account is in the No rep section below."}
        </p>
        {cards.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <RepCardView key={c.rep} card={c} selected={shown === c.rep} onShow={() => showOnMap(c.rep)} />
            ))}
          </ul>
        ) : null}
      </section>

      <section aria-labelledby="territory-no-rep" data-testid="territory-no-rep">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="territory-no-rep" className="flex items-center gap-2 font-display text-xl">
              <Swatch color={NO_REP_COLOR} className="size-3" />
              No rep
            </h2>
            <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">
              {plural(noRep.total, "account")} with no rep · {noRep.pinned.toLocaleString("en-US")} on the map · {noRep.attention.toLocaleString("en-US")} need attention.
              {" "}Grouped into areas of pins within {AREA_MILES} mi of each other, with the rep who already has the most accounts close by.
              {scoped ? " Shown in full, not just your accounts." : ""}
            </p>
          </div>
          {noRep.pinned ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 self-start"
              aria-pressed={shown === NONE}
              onClick={() => showOnMap(NONE)}
              data-testid="territory-no-rep-show"
            >
              <MapPinned />
              Show On Map
            </Button>
          ) : null}
        </div>

        {noRep.total === 0 ? (
          <p className="mt-3 rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">Every account has a rep.</p>
        ) : !areas ? (
          <div className="mt-3 space-y-2" data-testid="territory-areas-loading">
            <p className="text-xs text-muted-foreground">Grouping accounts by area…</p>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card" data-testid="territory-areas">
            {areaPage.visible.map((area) => (
              <AreaRow
                key={area.key}
                label={area.label}
                items={area.items}
                suggestion={area.suggestion}
                open={openAreas.has(area.key)}
                onToggle={() => toggleArea(area.key)}
                onShow={() => showOnMap(NONE, area.items.map(pointOf).filter(isPoint))}
              />
            ))}
            <ShowMoreButton as="li" remaining={areaPage.remaining} onClick={areaPage.showMore} label="areas" />
            {areas.unplaced.length ? (
              <AreaRow
                label="No pin yet"
                items={areas.unplaced}
                note="Not on the map, so not in an area. Importing the verified locations file can place them."
                open={openAreas.has("unplaced")}
                onToggle={() => toggleArea("unplaced")}
              />
            ) : null}
            {!areas.areas.length && !areas.unplaced.length ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing to group.</li> : null}
          </ul>
        )}
      </section>
    </div>
  );
}

function RepCardView({ card: c, selected, onShow }: { card: RepCard; selected: boolean; onShow: () => void }) {
  return (
    <li
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]",
        selected ? "border-primary/60 ring-2 ring-primary/20" : "border-border",
      )}
      data-testid="territory-card"
    >
      <h3 className="flex min-w-0 items-center gap-2 font-medium">
        <Swatch color={c.color} className="size-3" />
        <span className="truncate">
          <RepName name={c.rep} />
        </span>
      </h3>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <Stat label="Accounts" value={c.accounts} />
        <Stat label="On the map" value={c.pinned} />
        <Stat label="Need attention" value={c.attention} warn={c.attention > 0} />
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">
        {c.medianMiles != null ? (
          <>
            Typical spread: half the pins are within <span className="font-medium text-foreground">{milesLabel(c.medianMiles)}</span> of the center
          </>
        ) : (
          "No pins yet, so no spread to show"
        )}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground" title={c.cities.map(([city, n]) => `${city} ${n}`).join(" · ")}>
        {c.cities.length ? (
          c.cities.map(([city, n], i) => (
            <span key={city}>
              {i ? " · " : ""}
              {city} <span className="tabular font-medium text-foreground">{n}</span>
            </span>
          ))
        ) : (
          "No cities on file"
        )}
      </p>
      <div className="mt-auto pt-3">
        <Button type="button" variant={selected ? "secondary" : "outline"} size="sm" className="h-9" aria-pressed={selected} onClick={onShow} disabled={!c.pinned}>
          <MapPinned />
          Show On Map
        </Button>
      </div>
    </li>
  );
}

function Stat({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 px-2.5 py-2">
      <dt className="truncate text-[11px] text-muted-foreground">{label}</dt>
      <dd className={cn("font-display text-xl tabular leading-tight", warn && "text-warning")}>{value.toLocaleString("en-US")}</dd>
    </div>
  );
}

function AreaRow({
  label,
  items,
  suggestion,
  note,
  open,
  onToggle,
  onShow,
}: {
  label: string;
  items: AccountGeo[];
  suggestion?: Suggestion;
  note?: string;
  open: boolean;
  onToggle: () => void;
  onShow?: () => void;
}) {
  const paged = useShowMore(items, open, 25);
  return (
    <li className="border-b border-border last:border-b-0" data-testid="territory-area">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="desk-flat flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{label}</span>
          <span className="block text-xs text-muted-foreground">
            {note ??
              (suggestion ? (
                <>
                  Nearest rep: <span className="font-medium text-foreground">{suggestion.rep}</span> ({plural(suggestion.count, "account")} within {AREA_MILES} mi)
                </>
              ) : (
                `No rep within ${AREA_MILES} mi`
              ))}
          </span>
        </span>
        <span className="shrink-0 text-sm font-medium tabular" aria-label={plural(items.length, "account")}>
          {items.length.toLocaleString("en-US")}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div className="px-4 pb-3">
          {onShow ? (
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={onShow}>
              <MapPinned />
              Show On Map
            </Button>
          ) : null}
          <ul className={cn("overflow-hidden rounded-lg border border-border", onShow && "mt-2")}>
            {paged.visible.map((a) => (
              <li key={a.id} className="border-b border-border last:border-b-0">
                <OpenLink entityType="customer" id={a.id} className="flex min-h-10 items-center gap-2 px-3 py-2 text-sm hover:bg-muted/60">
                  <span className="min-w-0 flex-1 truncate">
                    {a.name}
                    <AkBadge on={a.aviKatz} className="ml-1.5 align-middle" />
                  </span>
                  {a.quality === "approx" ? <span className="shrink-0 text-[11px] text-muted-foreground">ZIP area</span> : null}
                  {a.city ? <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">{a.city}</span> : null}
                </OpenLink>
              </li>
            ))}
            <ShowMoreButton as="li" remaining={paged.remaining} onClick={paged.showMore} label="accounts" />
          </ul>
        </div>
      ) : null}
    </li>
  );
}

/** The tapped pin, over the map's corner: name, rep, city, and a way into the account. */
function PinCard({ account: a, onClose }: { account: AccountGeo; onClose: () => void }) {
  return (
    <div
      className="absolute top-2 right-2 left-14 z-10 rounded-lg border border-border bg-card/95 p-3 shadow-[var(--shadow-soft)] sm:left-auto sm:w-72"
      data-testid="territory-pin-card"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {a.name}
            <AkBadge on={a.aviKatz} className="ml-1.5 align-middle" />
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {a.rep ? <RepName name={a.rep} /> : <NoRepFlag show />}
            {a.city ? ` · ${a.city}` : ""}
          </p>
          {a.quality === "approx" ? <p className="text-[11px] text-muted-foreground">ZIP area (approximate)</p> : null}
        </div>
        <Button type="button" variant="ghost" size="icon" className="-mt-1 -mr-1 size-9" onClick={onClose} aria-label="Close">
          <X />
        </Button>
      </div>
      <Button asChild size="sm" className="mt-2 h-9 px-3">
        <Link to="/customers" search={{ open: a.id }}>
          <Store />
          Open Account
        </Link>
      </Button>
    </div>
  );
}
