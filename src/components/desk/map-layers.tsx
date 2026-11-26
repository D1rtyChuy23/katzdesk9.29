import { useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, ExternalLink, Globe, Mountain, Navigation, Phone, RotateCcw, X } from "lucide-react";
import { getMyAccess } from "@/lib/ops/access";
import { isDeskAdmin } from "@/lib/ops/admin-role";
import { listZipStats } from "@/lib/ops/market-api";
import { count, densityColor, density, dollars, DENSITY_STEPS, zipRadius, zipRequest, ZIP_MIN_ZOOM, ZIP_SOURCE, type Bounds, type ZipStat } from "@/lib/ops/market-map";
import {
  DEFAULT_PLACE_CATEGORIES,
  isPlaceCategory,
  containsBounds,
  formatPhone,
  missingCategories,
  nearestAccount,
  nearestRep,
  osmUrl,
  overpassQuery,
  OVERPASS_SERVERS,
  padBounds,
  parseOverpassCsv,
  placeAddress,
  PLACE_CATEGORIES,
  PLACE_CATEGORY,
  PLACES_LIMIT,
  PLACES_MIN_ZOOM,
  PLACES_SOURCE,
  PLACE_CACHE_MAX,
  prospectRows,
  readPlaceCache,
  PROSPECT_COLUMNS,
  websiteUrl,
  type AccountPoint,
  type CachedFetch,
  type Place,
  type PlaceCategory,
} from "@/lib/ops/places";
import { decodeTerrarium, elevationLabel, elevationPixel, ELEVATION_SOURCE, terrariumUrl } from "@/lib/ops/elevation";
import { directionsUrl, milesLabel, type LatLng } from "@/lib/ops/geo";
import { toCsv } from "@/lib/ops/customer-export";
import { todayChicago } from "@/lib/ops/clock";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FilterChip } from "./desk-charts";
import { RepName } from "./rep-select";
import type { MapBase, MapBounds, MapPin } from "./desk-map";

// ---------------------------------------------------------------------------------------------------------------------
// Who gets the market layers, and what each viewer picked

/** Admin (or the owner flag) and Sales get Population and Places (Chuy, 11/26). Everyone gets Terrain and elevation. */
export function useMarketAccess(): boolean {
  const me = useQuery({ queryKey: ["access", "me"], queryFn: () => getMyAccess() });
  return !!me.data?.approved && (isDeskAdmin(me.data) || me.data.role === "sales");
}

export type MapLayerPrefs = {
  base: MapBase;
  population: boolean;
  places: boolean;
  categories: PlaceCategory[];
  /** Places that are already one of our accounts are left off (on unless the viewer turns it off). */
  hideCustomers: boolean;
};

const DEFAULT_PREFS: MapLayerPrefs = { base: "streets", population: false, places: false, categories: [...DEFAULT_PLACE_CATEGORIES], hideCustomers: true };
const prefsKey = (userId: string) => `katz-desk-map-layers:${userId}`;

function readPrefs(raw: string | null): MapLayerPrefs {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<MapLayerPrefs>) : {};
    const categories = Array.isArray(v.categories) ? v.categories.filter(isPlaceCategory) : DEFAULT_PREFS.categories;
    return {
      base: v.base === "terrain" ? "terrain" : "streets",
      population: v.population === true,
      places: v.places === true,
      categories,
      hideCustomers: v.hideCustomers !== false,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

/** The viewer's layer choices, kept in this browser. Read after mount, so the server render and the first client one match. */
export function useMapLayerPrefs(userId: string): [MapLayerPrefs, (change: Partial<MapLayerPrefs>) => void] {
  const [prefs, setPrefs] = useState<MapLayerPrefs>(DEFAULT_PREFS);
  useEffect(() => {
    try {
      setPrefs(readPrefs(window.localStorage.getItem(prefsKey(userId))));
    } catch {
      /* storage blocked: the defaults */
    }
  }, [userId]);
  const update = (change: Partial<MapLayerPrefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...change };
      try {
        window.localStorage.setItem(prefsKey(userId), JSON.stringify(next));
      } catch {
        /* storage blocked: the choice still applies for this visit */
      }
      return next;
    });
  return [prefs, update];
}

// ---------------------------------------------------------------------------------------------------------------------
// Elevation

const TILE_CACHE_MAX = 24;
const tileCache = new Map<string, Promise<ImageData>>();

/** A terrarium tile's pixels (the tiles allow cross-origin reads, so the canvas can be read). */
function terrariumTile(z: number, x: number, y: number): Promise<ImageData> {
  const key = `${z}/${x}/${y}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const p = new Promise<ImageData>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || 256;
        canvas.height = img.naturalHeight || 256;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("No canvas");
        ctx.drawImage(img, 0, 0);
        resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      } catch (e) {
        reject(e instanceof Error ? e : new Error("Could not read the elevation tile."));
      }
    };
    img.onerror = () => reject(new Error("The elevation tile could not load."));
    img.src = terrariumUrl(z, x, y);
  });
  p.catch(() => tileCache.delete(key));
  tileCache.set(key, p);
  while (tileCache.size > TILE_CACHE_MAX) tileCache.delete(tileCache.keys().next().value!);
  return p;
}

/** Meters above sea level at a point. */
export async function readElevation(lat: number, lng: number): Promise<number> {
  const { z, x, y, px, py } = elevationPixel(lat, lng);
  const tile = await terrariumTile(z, x, y);
  const i = (py * tile.width + px) * 4;
  return decodeTerrarium(tile.data[i]!, tile.data[i + 1]!, tile.data[i + 2]!);
}

export function useElevation(point: LatLng | null | undefined) {
  const lat = point ? Math.round(point.lat * 1e4) / 1e4 : null;
  const lng = point ? Math.round(point.lng * 1e4) / 1e4 : null;
  return useQuery({
    queryKey: ["elevation", lat, lng],
    queryFn: () => readElevation(lat!, lng!),
    enabled: lat != null && lng != null,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: 1,
  });
}

/** "Elevation: About 52 ft (16 m)", for a card. */
export function ElevationLine({ point, className }: { point: LatLng | null | undefined; className?: string }) {
  const q = useElevation(point);
  if (!point) return null;
  return (
    <p className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)} title={ELEVATION_SOURCE} data-testid="map-elevation">
      <Mountain className="size-3.5 shrink-0" aria-hidden />
      Elevation: {q.isPending ? "…" : q.isError ? "Not available" : elevationLabel(q.data)}
    </p>
  );
}

/** Where the viewer last tapped the terrain map, and the height there. */
export function TapReadout({ at, onClose }: { at: LatLng; onClose: () => void }) {
  const q = useElevation(at);
  return (
    <div
      className="pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/95 py-1.5 pr-1 pl-3 text-sm shadow-[var(--shadow-soft)]"
      role="status"
      data-testid="map-tap-elevation"
    >
      <Mountain className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0">
        <span className="font-medium">{q.isPending ? "Reading the elevation…" : q.isError ? "Elevation not available here" : elevationLabel(q.data)}</span>
        <span className="block text-[11px] text-muted-foreground">
          {at.lat.toFixed(4)}, {at.lng.toFixed(4)}
        </span>
      </span>
      <Button type="button" variant="ghost" size="icon" className="size-8" onClick={onClose} aria-label="Close elevation">
        <X />
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Population by ZIP

/** The ZIP areas on screen (Admin and Sales), while the layer is on and the map is zoomed in enough. */
export function useZipStats(view: MapBounds | null, on: boolean) {
  const ask = view ? zipRequest(view.zoom) : null;
  const box = view && ask && on && view.zoom >= ZIP_MIN_ZOOM ? padBounds(view, 0.25, ask.snap) : null;
  return useQuery({
    queryKey: ["zip-stats", box?.south, box?.west, box?.north, box?.east, ask?.limit],
    queryFn: () => listZipStats({ data: { ...box!, limit: ask!.limit } }),
    enabled: !!box,
    staleTime: 60 * 60_000,
    placeholderData: keepPreviousData,
  });
}

export const zipPinId = (zip: string) => `zip:${zip}`;
export const placePinId = (id: string) => `place:${id}`;

export function zipPins(zips: readonly ZipStat[]): MapPin[] {
  // Biggest first, so a small ZIP's circle draws on top of a big neighbor's and can still be tapped.
  return [...zips]
    .sort((a, b) => b.population - a.population)
    .map((z) => {
      const d = density(z);
      return {
        id: zipPinId(z.zip),
        lat: z.lat,
        lng: z.lng,
        color: densityColor(d),
        size: zipRadius(z.population),
        opacity: 0.42,
        plain: true,
        title: `ZIP ${z.zip} · ${count(z.population)} people${d != null ? ` · ${count(d)} per sq mi` : ""}`,
      };
    });
}

/** The Population layer's key: density colors and what the size means. */
export function PopulationKey({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)} data-testid="map-population-key">
      <span className="font-medium text-foreground">People per sq mi</span>
      {DENSITY_STEPS.map((s) => (
        <span key={s.label} className="inline-flex items-center gap-1">
          <span className="inline-block size-3 rounded-full" style={{ background: s.color, opacity: 0.75 }} aria-hidden />
          {s.label}
        </span>
      ))}
      <span>· Bigger circle, more people</span>
    </div>
  );
}

export function ZipCard({ zip: z, accounts, onClose }: { zip: ZipStat; accounts: readonly AccountPoint[]; onClose: () => void }) {
  const d = density(z);
  const reps = useMemo(() => [...new Set(accounts.map((a) => a.rep).filter((r): r is string => !!r))].sort(), [accounts]);
  const food = z.cafes + z.restaurants + z.bars;
  return (
    <section className="shrink-0 border-b border-border p-4" aria-label={`ZIP ${z.zip}`} data-testid="map-zip-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base leading-snug font-medium">ZIP {z.zip}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Population and businesses (Census)</p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="-mt-1.5 -mr-2 size-9" onClick={onClose} aria-label="Close ZIP details">
          <X />
        </Button>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <Stat label="People" value={count(z.population)} testId="map-zip-population" />
        <Stat label="People per sq mi" value={d == null ? "—" : count(d)} />
        <Stat label="Median household income" value={dollars(z.income)} />
        <Stat label="Businesses" value={count(z.businesses)} />
        <Stat label="Coffee & snack bars" value={count(z.cafes)} />
        <Stat label="Restaurants" value={count(z.restaurants)} />
        <Stat label="Bars" value={count(z.bars)} />
        <Stat label="Hotels & motels" value={count(z.hotels)} />
      </dl>
      <div className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs" data-testid="map-zip-coverage">
        <p>
          <span className="font-medium">Our accounts here: {count(accounts.length)}</span>
          {food ? ` · ${count(food)} places that serve food or drink` : ""}
        </p>
        {reps.length ? (
          <p className="mt-0.5 text-muted-foreground">
            Reps:{" "}
            {reps.map((r, i) => (
              <span key={r}>
                {i ? ", " : ""}
                <RepName name={r} />
              </span>
            ))}
          </p>
        ) : null}
      </div>
      <ElevationLine point={z} className="mt-2" />
      <p className="mt-2 text-[11px] text-muted-foreground">{ZIP_SOURCE} The circle sits at the ZIP area&apos;s center.</p>
    </section>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Places (prospects)

/** The main server gets 40 seconds; a mirror, used only when it fails, gets 60. */
const placeTimeout = (i: number) => (i === 0 ? 40_000 : 60_000);
const PLACE_CACHE_KEY = "katz-desk-places-v1";

function loadPlaceCache(): CachedFetch[] {
  try {
    return readPlaceCache(window.localStorage.getItem(PLACE_CACHE_KEY), Date.now());
  } catch {
    return [];
  }
}
function savePlaceCache(entries: CachedFetch[]) {
  // When the browser's storage is full, the older half goes, then half again.
  for (let list = entries.slice(-PLACE_CACHE_MAX); list.length; list = list.slice(Math.ceil(list.length / 2))) {
    try {
      window.localStorage.setItem(PLACE_CACHE_KEY, JSON.stringify(list));
      return;
    } catch {
      /* full or blocked: try with fewer */
    }
  }
}

/** Asks each Overpass server in turn until one answers with places (a busy server says so with 429 or 504). */
async function fetchPlaces(b: Bounds, categories: readonly PlaceCategory[], signal: AbortSignal): Promise<{ places: Place[]; rows: number }> {
  const query = overpassQuery(b, categories);
  let problem: unknown = null;
  for (const [i, server] of OVERPASS_SERVERS.entries()) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const ctrl = new AbortController();
    const stop = () => ctrl.abort();
    signal.addEventListener("abort", stop);
    const timer = setTimeout(stop, placeTimeout(i));
    try {
      // GET keeps it a simple request (no preflight); the query is well under any URL limit.
      const res = await fetch(`${server}?data=${encodeURIComponent(query)}`, { signal: ctrl.signal });
      const text = await res.text();
      if (!res.ok || !text.startsWith("@type")) throw new Error(`${server} answered ${res.status}`);
      // Rows as the server sent them (some are skipped as places), to tell whether it stopped at the limit.
      const rows = text.split("\n").filter((l) => l.trim()).length - 1;
      return { places: parseOverpassCsv(text), rows };
    } catch (e) {
      if (signal.aborted) throw e;
      problem = e;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", stop);
    }
  }
  throw problem instanceof Error ? problem : new Error("No places server answered.");
}

export type PlacesStatus = "off" | "zoom" | "loading" | "error" | "ready";

/** Keep at most about this many places in memory; the oldest answers go first, whole. */
const PLACES_KEPT = 20_000;

type InFlight = { box: Bounds; categories: readonly PlaceCategory[]; ctrl: AbortController };

/**
 * Places on screen for the categories picked. Asks only for what no complete answer covers (a category newly turned
 * on, or a part of the map not seen yet), a little wider than the screen so small pans need nothing new. A request
 * already on its way that covers the new view is left to finish rather than started again.
 */
export function usePlaces(view: MapBounds | null, on: boolean, categories: readonly PlaceCategory[]) {
  const [places, setPlaces] = useState<Map<string, Place>>(() => new Map());
  const [status, setStatus] = useState<PlacesStatus>("off");
  const [truncated, setTruncated] = useState(false);
  const [attempt, setAttempt] = useState(0);
  /** Complete answers, oldest first: what counts as covered, and what this browser keeps for a week. */
  const answers = useRef<CachedFetch[]>([]);
  /** The latest answer that stopped at the limit: drawn, but not counted as covering its box. */
  const partial = useRef<Place[]>([]);
  const cacheRead = useRef(false);
  const inFlight = useRef<InFlight | null>(null);
  const catKey = categories.join(",");

  /** The places from the answers kept, dropping the oldest answers whole when there are too many (so nothing dropped still counts as covered). */
  function rebuild() {
    let total = partial.current.length + answers.current.reduce((n, a) => n + a.places.length, 0);
    while (answers.current.length > 1 && total > PLACES_KEPT) total -= answers.current.shift()!.places.length;
    const next = new Map<string, Place>();
    for (const a of answers.current) for (const p of a.places) next.set(p.id, p);
    for (const p of partial.current) next.set(p.id, p);
    setPlaces(next);
  }

  // Answers from earlier visits (this browser, last 7 days), read the first time the layer is on.
  useEffect(() => {
    if (!on || cacheRead.current) return;
    cacheRead.current = true;
    answers.current = loadPlaceCache();
    if (answers.current.length) rebuild();
  }, [on]);

  useEffect(() => {
    if (!on || !view || !categories.length) {
      inFlight.current?.ctrl.abort();
      inFlight.current = null;
      setStatus("off");
      return;
    }
    if (view.zoom < PLACES_MIN_ZOOM - 0.01) {
      setStatus("zoom");
      return;
    }
    const missing = missingCategories(view, categories, answers.current);
    if (!missing.length) {
      setTruncated(false);
      setStatus("ready");
      return;
    }
    const going = inFlight.current;
    if (going && containsBounds(going.box, view) && missing.every((c) => going.categories.includes(c))) {
      setStatus("loading");
      return;
    }
    // Wait a moment: the map reports each place it comes to rest, and a quick second pan replaces this one.
    const timer = setTimeout(() => {
      inFlight.current?.ctrl.abort();
      const box = padBounds(view);
      const mine: InFlight = { box, categories: missing, ctrl: new AbortController() };
      inFlight.current = mine;
      setStatus("loading");
      fetchPlaces(box, missing, mine.ctrl.signal)
        .then(({ places: found, rows }) => {
          if (inFlight.current !== mine) return;
          inFlight.current = null;
          const full = rows >= PLACES_LIMIT;
          setTruncated(full);
          if (full) partial.current = found;
          else {
            answers.current = [...answers.current, { bounds: box, categories: missing, at: Date.now(), places: found }];
            savePlaceCache(answers.current);
          }
          rebuild();
          setStatus("ready");
        })
        .catch(() => {
          if (inFlight.current !== mine) return;
          inFlight.current = null;
          setStatus("error");
        });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- categories is keyed by catKey
  }, [on, view, catKey, attempt]);

  useEffect(() => () => inFlight.current?.ctrl.abort(), []);
  return { places, status, truncated, retry: () => setAttempt((n) => n + 1) };
}

export function placePins(places: readonly Place[], matched: ReadonlyMap<string, AccountPoint>): MapPin[] {
  return places.map((p) => {
    const def = PLACE_CATEGORY.get(p.category);
    const account = matched.get(p.id);
    return {
      id: placePinId(p.id),
      lat: p.lat,
      lng: p.lng,
      color: account ? "#a8a29e" : (def?.color ?? "#57534e"),
      shape: "square" as const,
      size: 4.5,
      opacity: account ? 0.6 : 0.95,
      title: `${p.name} · ${def?.label ?? "Place"}${account ? ` · Already an account: ${account.name}` : ""}`,
    };
  });
}

/** The map's status for the Places layer, top right (under the elevation readout when both show). */
export function PlacesNote({ status, truncated, onRetry, className }: { status: PlacesStatus; truncated: boolean; onRetry: () => void; className?: string }) {
  const text =
    status === "zoom"
      ? "Zoom in to see places"
      : status === "loading"
        ? "Loading places… (OpenStreetMap can take up to a minute when it is busy)"
        : status === "error"
          ? "Places could not load (the OpenStreetMap server is busy)."
          : truncated
            ? `Showing the first ${PLACES_LIMIT.toLocaleString("en-US")} places here. Zoom in for all of them.`
            : null;
  if (!text) return null;
  return (
    <div
      className={cn("pointer-events-auto flex items-center gap-2 rounded-lg border border-border bg-card/95 px-3 py-1.5 text-xs shadow-[var(--shadow-soft)]", status === "error" && "text-destructive", className)}
      role="status"
      data-testid="map-places-note"
    >
      <span>{text}</span>
      {status === "error" ? (
        <Button type="button" size="sm" variant="outline" className="h-7 px-2" onClick={onRetry}>
          <RotateCcw />
          Try Again
        </Button>
      ) : null}
    </div>
  );
}

/** The Places layer's key: one square per category that is on, with how many are on the map. */
export function PlacesKey({ counts, className }: { counts: ReadonlyMap<PlaceCategory, number>; className?: string }) {
  const items = PLACE_CATEGORIES.filter((c) => counts.has(c.id));
  if (!items.length) return null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground", className)} data-testid="map-places-key">
      {items.map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1">
          <span className="inline-block size-2.5 rounded-[2px]" style={{ background: c.color }} aria-hidden />
          {c.label} {(counts.get(c.id) ?? 0).toLocaleString("en-US")}
        </span>
      ))}
    </div>
  );
}

function saveCsv(name: string, text: string) {
  // The byte-order mark makes Excel read the file as UTF-8, so accented names stay right.
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Download the prospects on screen as a call list, each with its nearest account that has a rep. */
export function DownloadProspects({ places, accounts }: { places: readonly Place[]; accounts: readonly AccountPoint[] }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-8 px-2.5"
      disabled={!places.length}
      onClick={() => {
        const rows = prospectRows(places, accounts);
        saveCsv(`KatzDesk-Prospects-${todayChicago()}.csv`, toCsv(PROSPECT_COLUMNS, rows));
      }}
      data-testid="map-download-prospects"
    >
      <Download />
      Download List
    </Button>
  );
}

export function PlaceCard({
  place: p,
  account,
  sameAddress,
  accounts,
  onOpenAccount,
  onClose,
}: {
  place: Place;
  /** The account this place is (same name, close by). */
  account: AccountPoint | null;
  /** An account at the same street address under another name: maybe the same place, maybe a neighbor. */
  sameAddress: AccountPoint | null;
  accounts: readonly AccountPoint[];
  onOpenAccount: (id: number) => void;
  onClose: () => void;
}) {
  const def = PLACE_CATEGORY.get(p.category);
  const address = placeAddress(p);
  const site = websiteUrl(p.website);
  const near = useMemo(() => (account ? null : nearestAccount(p, accounts)), [account, accounts, p]);
  const repNear = useMemo(() => (account || !near || near.account.rep ? null : nearestRep(p, accounts)), [account, near, accounts, p]);
  const phone = formatPhone(p.phone);
  const url = directionsUrl({ point: p, quality: "exact" });
  return (
    <section className="shrink-0 border-b border-border p-4" aria-label={`Selected place: ${p.name}`} data-testid="map-place-card">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-base leading-snug font-medium">{p.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-block size-2.5 rounded-[2px]" style={{ background: def?.color }} aria-hidden />
            {def?.label ?? "Place"}
            {p.cuisine ? ` · ${p.cuisine.replace(/_/g, " ").replace(/;/g, ", ")}` : ""}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" className="-mt-1.5 -mr-2 size-9" onClick={onClose} aria-label="Close place details">
          <X />
        </Button>
      </div>
      <p className={cn("mt-2 text-sm", !address && "text-muted-foreground")}>{address ?? "No address listed"}</p>
      {account ? (
        <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-xs" data-testid="map-place-account">
          Already an account:{" "}
          <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => onOpenAccount(account.id)}>
            {account.name}
          </button>
          {account.rep ? (
            <>
              {" · "}
              <RepName name={account.rep} />
            </>
          ) : null}
        </p>
      ) : (
        <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-xs" data-testid="map-place-prospect">
          <span className="font-medium">Prospect</span>: not one of our accounts.
          {near ? (
            <>
              {" "}
              Nearest account: {near.account.name}, {milesLabel(near.miles)}
              {near.account.rep ? (
                <>
                  {" ("}
                  <RepName name={near.account.rep} />)
                </>
              ) : " (no rep)"}
              .
            </>
          ) : null}
          {repNear?.account.rep ? (
            <>
              {" "}
              Nearest rep: <RepName name={repNear.account.rep} /> ({repNear.account.name}, {milesLabel(repNear.miles)}).
            </>
          ) : null}
          {sameAddress ? (
            <>
              {" "}
              Same street address as our account{" "}
              <button type="button" className="font-medium text-primary underline-offset-4 hover:underline" onClick={() => onOpenAccount(sameAddress.id)} data-testid="map-place-same-address">
                {sameAddress.name}
              </button>
              : it may be the same place under another name, or a neighbor in the same building.
            </>
          ) : null}
        </p>
      )}
      <ul className="mt-2 space-y-1 text-xs">
        {phone ? (
          <li className="flex items-center gap-1.5">
            <Phone className="size-3.5 text-muted-foreground" aria-hidden />
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="text-primary underline-offset-4 hover:underline">
              {phone}
            </a>
          </li>
        ) : null}
        {site ? (
          <li className="flex min-w-0 items-center gap-1.5">
            <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <a href={site} target="_blank" rel="noreferrer" className="truncate text-primary underline-offset-4 hover:underline">
              {site.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
            </a>
          </li>
        ) : null}
        {p.hours ? <li className="text-muted-foreground">Hours: {p.hours}</li> : null}
      </ul>
      <ElevationLine point={p} className="mt-2" />
      <div className="mt-3 flex flex-wrap gap-2">
        {url ? (
          <Button asChild size="sm" variant="outline" className="h-9 px-3">
            <a href={url} target="_blank" rel="noreferrer" data-testid="map-place-directions">
              <Navigation />
              Directions
            </a>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="outline" className="h-9 px-3">
          <a href={osmUrl(p.id)} target="_blank" rel="noreferrer">
            <ExternalLink />
            OpenStreetMap
          </a>
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{PLACES_SOURCE}</p>
    </section>
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// The controls

/** Map, Population and Places switches, and the place types when Places is on. */
export function LayerControls({ prefs, onChange, market }: { prefs: MapLayerPrefs; onChange: (c: Partial<MapLayerPrefs>) => void; market: boolean }) {
  const toggleCategory = (id: PlaceCategory) =>
    onChange({ categories: prefs.categories.includes(id) ? prefs.categories.filter((c) => c !== id) : PLACE_CATEGORIES.map((c) => c.id).filter((c) => c === id || prefs.categories.includes(c)) });
  return (
    <div className="mt-3 space-y-3" data-testid="map-layers">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Map layers">
        <span className="mr-1 text-xs font-medium text-muted-foreground max-sm:w-full">Layers</span>
        <FilterChip
          selected={prefs.base === "terrain"}
          onClick={() => onChange({ base: prefs.base === "terrain" ? "streets" : "terrain" })}
          title="Hills, contour lines and heights. Tap the map to read the elevation there."
          data-testid="map-layer-terrain"
        >
          Terrain
        </FilterChip>
        {market ? (
          <>
            <FilterChip selected={prefs.population} onClick={() => onChange({ population: !prefs.population })} title="People per ZIP code (Census)" data-testid="map-layer-population">
              Population
            </FilterChip>
            <FilterChip
              selected={prefs.places}
              onClick={() => onChange({ places: !prefs.places })}
              title="Coffee shops, restaurants, hotels, colleges and other possible customers (OpenStreetMap)"
              data-testid="map-layer-places"
            >
              Prospects
            </FilterChip>
          </>
        ) : null}
      </div>
      {market && prefs.places ? (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Place types" data-testid="map-place-types">
          <span className="mr-1 text-xs font-medium text-muted-foreground max-sm:w-full">Places</span>
          {PLACE_CATEGORIES.map((c) => (
            <FilterChip key={c.id} selected={prefs.categories.includes(c.id)} onClick={() => toggleCategory(c.id)} data-testid={`map-place-${c.id}`}>
              <span className="mr-1.5 inline-block size-2.5 rounded-[2px] align-middle" style={{ background: c.color }} aria-hidden />
              {c.label}
            </FilterChip>
          ))}
          <FilterChip
            selected={!prefs.hideCustomers}
            onClick={() => onChange({ hideCustomers: !prefs.hideCustomers })}
            title="Also show places that are already our accounts, in gray"
            data-testid="map-place-show-customers"
          >
            Show Current Accounts
          </FilterChip>
        </div>
      ) : null}
    </div>
  );
}
