/**
 * The Map's Prospects (Chuy, 11/26–27): coffee shops, restaurants, hotels, colleges, offices and other places that could
 * buy coffee or service, for Admin and Sales. They come from the Overture Maps places data (Overture Maps Foundation,
 * CDLA Permissive 2.0, which includes OpenStreetMap), cut to Texas and the place types below by
 * scripts/build-places.py into one file per 1° square under src/lib/ops/places-tiles/. The server reads only the
 * squares on screen (market-api.ts listPlaces). A place that is already one of our accounts (same name, close by) is
 * marked so the map can show only prospects. Pure: safe for node --test and the screens.
 */
import { milesBetween, type LatLng } from "./geo.ts";
import type { Bounds } from "./market-map.ts";

export type PlaceCategory =
  | "coffee"
  | "bakery"
  | "restaurant"
  | "fastfood"
  | "bar"
  | "hotel"
  | "college"
  | "hospital"
  | "office"
  | "senior"
  | "cinema"
  | "grocery"
  | "convenience"
  | "cardealer";

type CategoryDef = {
  id: PlaceCategory;
  label: string;
  color: string;
  /** On when the viewer has not chosen yet. */
  initially: boolean;
};

/** In the order the filter lists them. Places are drawn as small squares, so these never read as rep colors. */
export const PLACE_CATEGORIES: readonly CategoryDef[] = [
  { id: "coffee", label: "Coffee Shops & Cafés", color: "#6f4e37", initially: true },
  { id: "bakery", label: "Bakeries & Donuts", color: "#c2410c", initially: true },
  { id: "restaurant", label: "Restaurants", color: "#be123c", initially: true },
  { id: "hotel", label: "Hotels", color: "#1d4ed8", initially: true },
  { id: "college", label: "Colleges & Universities", color: "#7e22ce", initially: true },
  { id: "office", label: "Corporate Offices", color: "#0369a1", initially: false },
  { id: "senior", label: "Senior Living", color: "#4d7c0f", initially: false },
  { id: "hospital", label: "Hospitals & Clinics", color: "#0f766e", initially: false },
  { id: "cinema", label: "Movie Theaters", color: "#a16207", initially: false },
  { id: "bar", label: "Bars", color: "#9d174d", initially: false },
  { id: "fastfood", label: "Fast Food", color: "#b45309", initially: false },
  { id: "grocery", label: "Grocery Stores", color: "#15803d", initially: false },
  { id: "convenience", label: "Convenience & Gas", color: "#475569", initially: false },
  { id: "cardealer", label: "Car Dealerships", color: "#334155", initially: false },
];

export const PLACE_CATEGORY = new Map(PLACE_CATEGORIES.map((c) => [c.id, c]));
export const isPlaceCategory = (v: unknown): v is PlaceCategory => typeof v === "string" && PLACE_CATEGORY.has(v as PlaceCategory);
export const DEFAULT_PLACE_CATEGORIES: readonly PlaceCategory[] = PLACE_CATEGORIES.filter((c) => c.initially).map((c) => c.id);

/** Prospects show from this zoom in (about a county). Wider, a city has tens of thousands and the most likely are shown. */
export const PLACES_MIN_ZOOM = 10;
/** One answer holds at most this many places, the surest first; more means "zoom in for all of them". */
export const PLACES_LIMIT = 3000;

export const PLACES_SOURCE =
  "Places: Overture Maps Foundation (CDLA Permissive 2.0), including © OpenStreetMap contributors. Texas only. Not every business is listed, and some listings are out of date.";

export type Place = {
  /** Overture's id for the place. */
  id: string;
  name: string;
  category: PlaceCategory;
  /** What kind of place, in Overture's words ("mexican restaurant", "coffee shop"); null when it says no more than the category. */
  kind: string | null;
  lat: number;
  lng: number;
  /** "502 Texas Ave", when the data has it. */
  street: string | null;
  city: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  brand: string | null;
  /** How sure Overture is the place exists (0–1). */
  confidence: number;
};

// ---------------------------------------------------------------------------------------------------------------------
// The files: one per 1° square

/** "29_-96" for the square from 29°N to 30°N and 96°W to 95°W: the file src/lib/ops/places-tiles/29_-96.tsv. */
export function placeTileKey(lat: number, lng: number): string {
  return `${Math.floor(lat)}_${Math.floor(lng)}`;
}

/** Squares one answer reads at most: a big screen at the widest Prospects zoom touches about 40. */
export const PLACE_TILES_MAX = 60;

/** Every square a box touches, and whether there were more than `max` (the rest are left out). */
export function placeTilesFor(b: Bounds, max = PLACE_TILES_MAX): { keys: string[]; capped: boolean } {
  const keys: string[] = [];
  for (let la = Math.floor(b.south); la <= Math.floor(b.north); la++) {
    for (let ln = Math.floor(b.west); ln <= Math.floor(b.east); ln++) {
      if (keys.length >= max) return { keys, capped: true };
      keys.push(`${la}_${ln}`);
    }
  }
  return { keys, capped: false };
}

export const PLACE_TILE_COLUMNS = ["id", "name", "category", "kind", "lat", "lng", "street", "city", "zip", "phone", "website", "brand", "confidence"] as const;

const cell = (s: string | undefined) => {
  const t = (s ?? "").trim();
  return t ? t : null;
};

/** A square's file (tab separated, header first) into places. Rows that do not parse, or name no known type, are skipped. */
export function parsePlaceTile(text: string): Place[] {
  const lines = text.split(/\r?\n/);
  const out: Place[] = [];
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i]!.split("\t");
    if (c.length < PLACE_TILE_COLUMNS.length) continue;
    const [id, name, category, kind, lat, lng, street, city, zip, phone, website, brand, confidence] = c;
    const la = Number(lat);
    const ln = Number(lng);
    if (!cell(id) || !cell(name) || !isPlaceCategory(category) || !Number.isFinite(la) || !Number.isFinite(ln)) continue;
    out.push({
      id: id!,
      name: name!.trim(),
      category,
      kind: cell(kind),
      lat: la,
      lng: ln,
      street: cell(street),
      city: cell(city),
      zip: cell(zip),
      phone: cell(phone),
      website: cell(website),
      brand: cell(brand),
      confidence: Number(confidence) || 0,
    });
  }
  return out;
}

/** Whether a place matches what was typed in the search box: its name, brand, kind or street, any case. */
export function placeFitsSearch(p: Place, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [p.name, p.brand, p.kind, p.street].some((v) => !!v && v.toLowerCase().includes(needle));
}

/**
 * The places of these types in the box (matching the search, if any), the surest first, at most `limit`; and how many
 * there were in all. Many places share a confidence, so ties go by id, which is random: a cut-off list is a fair
 * spread of the map, not the A's and B's.
 */
export function placesIn(
  all: readonly Place[],
  b: Bounds,
  categories: readonly PlaceCategory[],
  limit = PLACES_LIMIT,
  q = "",
): { places: Place[]; total: number } {
  const wanted = new Set(categories);
  const hits = all.filter((p) => wanted.has(p.category) && p.lat >= b.south && p.lat <= b.north && p.lng >= b.west && p.lng <= b.east && placeFitsSearch(p, q));
  hits.sort((a, c) => c.confidence - a.confidence || (a.id < c.id ? -1 : a.id > c.id ? 1 : 0));
  return { places: hits.slice(0, Math.max(0, limit)), total: hits.length };
}

/** Whether box `outer` holds all of box `inner`. */
export const containsBounds = (outer: Bounds, inner: Bounds) =>
  inner.south >= outer.south && inner.north <= outer.north && inner.west >= outer.west && inner.east <= outer.east;

/** "502 Texas Avenue, Houston 77002", or null. */
export function placeAddress(p: Pick<Place, "street" | "city" | "zip">): string | null {
  const tail = [p.city, p.zip].filter(Boolean).join(" ");
  const s = [p.street, tail].filter(Boolean).join(", ");
  return s || null;
}

/** A website that opens: listings sometimes leave off the https://. Null for anything that is not a web address. */
export function websiteUrl(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().split(/[;\s]/)[0] ?? "";
  if (!s) return null;
  const url = /^https?:\/\//i.test(s) ? s : /^[\w-]+(\.[\w-]+)+(\/|$)/.test(s) ? `https://${s}` : null;
  try {
    return url && /^https?:$/.test(new URL(url).protocol) ? url : null;
  } catch {
    return null;
  }
}

/** A web search for the place by name and address: the quickest way to its hours, menu and who runs it. */
export function searchUrl(p: Pick<Place, "name" | "street" | "city" | "zip">): string {
  return `https://www.google.com/search?q=${encodeURIComponent([p.name, p.street, p.city, p.zip].filter(Boolean).join(" "))}`;
}

/** A U.S. number as "(713) 227-1392" (listings write "+17132271392" or "+1-713-227-1392"); anything else as it was listed. */
export function formatPhone(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").split(";")[0]!.trim();
  if (!s) return null;
  const d = s.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d.length === 10 ? d : null;
  return ten ? `(${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : s;
}

// ---------------------------------------------------------------------------------------------------------------------
// Already a customer?

/** Words that say what kind of place it is, not which one ("Katz Coffee Cafe" and "Katz Coffee" are the same place). */
const GENERIC = new Set([
  "the",
  "and",
  "of",
  "at",
  "a",
  "cafe",
  "café",
  "coffee",
  "shop",
  "house",
  "co",
  "company",
  "inc",
  "llc",
  "ltd",
  "corp",
  "restaurant",
  "bar",
  "grill",
  "kitchen",
  "bakery",
  "hotel",
  "suites",
  "inn",
  "tx",
  "texas",
]);

/** A name's words that tell places apart: lower case, accents and punctuation gone, generic words dropped. */
export function nameTokens(name: string | null | undefined): string[] {
  const words = String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  // One-letter words ("A&M", "M Bar") say too little to tell places apart.
  const kept = words.filter((w) => !GENERIC.has(w) && w.length > 1);
  return kept.length ? kept : words;
}

/**
 * The same business by name: the shorter name's words start the longer one's, in order ("Star Cinema Grill" and "Star
 * Cinema Grill - Cypress", "Bean There Cafe" and "Bean There Coffee Co."). "Cafe Express" is not "Panda Express", and
 * "Hilton Houston" is not "Hilton Garden Inn Houston".
 */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((w, i) => long[i] === w);
}

const streetKey = (s: string | null | undefined) => {
  const m = String(s ?? "")
    .toLowerCase()
    .match(/^\s*(\d+[a-z]?)\s+(?:(?:n|s|e|w|north|south|east|west)\.?\s+)?([a-z0-9]+)/);
  return m ? `${m[1]} ${m[2]}` : null;
};

/** The same street address: house number and the street's first word ("502 Texas Ave" and "502 Texas Avenue, Houston"). */
export function sameStreet(placeStreet: string | null | undefined, accountAddress: string | null | undefined): boolean {
  const a = streetKey(placeStreet);
  const b = streetKey(accountAddress);
  return !!a && a === b;
}

/** Same name this close (miles) counts as the same place: one block, to allow for where each map put the pin. */
export const SAME_NAME_MILES = 0.15;
/** Same street address this close (miles) counts too, whatever the names (an account may use a legal name). */
export const SAME_ADDRESS_MILES = 0.1;

export type AccountPoint = { id: number; name: string; lat: number; lng: number; address: string | null; rep: string | null };

/**
 * How a place lines up with our accounts. "name": an account with the same name within SAME_NAME_MILES, so it is that
 * account (left off the map as a prospect). "address": only the same street address within SAME_ADDRESS_MILES, which
 * may be the same place under a legal name, or a neighbor in the same strip center: still a prospect, with a note.
 */
export type PlaceMatch = { account: AccountPoint; how: "name" | "address" };

/** For each place that lines up with an account, the closest one; a name match wins over an address match. Accounts are bucketed on a grid so thousands of each stay quick. */
export function matchAccounts(places: readonly Place[], accounts: readonly AccountPoint[]): Map<string, PlaceMatch> {
  const CELL = 0.01; // degrees, about 0.7 mile: a place only looks at its own cell and the ones around it
  const grid = new Map<string, AccountPoint[]>();
  const cell = (lat: number, lng: number) => `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;
  for (const a of accounts) {
    const k = cell(a.lat, a.lng);
    const list = grid.get(k);
    if (list) list.push(a);
    else grid.set(k, [a]);
  }
  const out = new Map<string, PlaceMatch>();
  for (const p of places) {
    const cy = Math.floor(p.lat / CELL);
    const cx = Math.floor(p.lng / CELL);
    let byName: { a: AccountPoint; miles: number } | null = null;
    let byAddress: { a: AccountPoint; miles: number } | null = null;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const a of grid.get(`${cy + dy}:${cx + dx}`) ?? []) {
          const miles = milesBetween(p, a);
          if (miles <= SAME_NAME_MILES && sameName(p.name, a.name) && (!byName || miles < byName.miles)) byName = { a, miles };
          else if (miles <= SAME_ADDRESS_MILES && sameStreet(p.street, a.address) && (!byAddress || miles < byAddress.miles)) byAddress = { a, miles };
        }
      }
    }
    if (byName) out.set(p.id, { account: byName.a, how: "name" });
    else if (byAddress) out.set(p.id, { account: byAddress.a, how: "address" });
  }
  return out;
}

/** The nearest account to a point (any distance), for "who covers this area", or null when there are none. */
export function nearestAccount<T extends LatLng>(point: LatLng, accounts: readonly T[]): { account: T; miles: number } | null {
  let best: { account: T; miles: number } | null = null;
  for (const a of accounts) {
    const miles = milesBetween(point, a);
    if (!best || miles < best.miles) best = { account: a, miles };
  }
  return best;
}

/** The nearest account that has a rep (the rep whose area this likely is), or null. */
export function nearestRep(point: LatLng, accounts: readonly AccountPoint[]): { account: AccountPoint; miles: number } | null {
  return nearestAccount(
    point,
    accounts.filter((a) => !!a.rep),
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Which part of the map still needs asking for

/** A box grown by `share` of its size on every side and snapped outward to a `snap`° grid, so small pans reuse it. */
export function padBounds(b: Bounds, share = 0.25, snap = 0.01): Bounds {
  const h = (b.north - b.south) * share;
  const w = (b.east - b.west) * share;
  return {
    south: Math.max(-90, Math.floor((b.south - h) / snap) * snap),
    west: Math.floor((b.west - w) / snap) * snap,
    north: Math.min(90, Math.ceil((b.north + h) / snap) * snap),
    east: Math.ceil((b.east + w) / snap) * snap,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The prospect list

export const PROSPECT_COLUMNS = [
  "Name",
  "Type",
  "Address",
  "City",
  "ZIP",
  "Phone",
  "Website",
  "Latitude",
  "Longitude",
  "Nearest Account",
  "Miles Away",
  "Nearest Rep",
  "Web Search",
] as const;

/**
 * One CSV row per place, for the download: the nearest account (any), how far, and the rep of the nearest account that
 * has one (the rep whose area it likely is).
 */
export function prospectRows(places: readonly Place[], accounts: readonly AccountPoint[]): string[][] {
  const withRep = accounts.filter((a) => !!a.rep);
  return places.map((p) => {
    const n = nearestAccount(p, accounts);
    const r = nearestAccount(p, withRep);
    return [
      p.name,
      PLACE_CATEGORY.get(p.category)?.label ?? p.category,
      p.street ?? "",
      p.city ?? "",
      p.zip ?? "",
      formatPhone(p.phone) ?? "",
      websiteUrl(p.website) ?? "",
      p.lat.toFixed(6),
      p.lng.toFixed(6),
      n?.account.name ?? "",
      n ? n.miles.toFixed(1) : "",
      r?.account.rep ?? "",
      searchUrl(p),
    ];
  });
}
