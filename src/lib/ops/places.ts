/**
 * The Map's Places layer (Chuy, 11/26): coffee shops, restaurants, hotels, colleges and other places that could buy
 * coffee or service, from OpenStreetMap, for Admin and Sales. The viewer's browser asks a public Overpass server for the
 * named places in the part of the map on screen; nothing is stored. A place that is already one of our accounts (same
 * name or same street address, close by) is marked so the map can show only prospects. Pure: safe for node --test.
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
  /** OpenStreetMap tags that put a place in this category. */
  tags: Partial<Record<"amenity" | "shop" | "tourism", readonly string[]>>;
};

/** In the order the layer lists them. Colors avoid the rep colors' look by drawing places as small squares. */
export const PLACE_CATEGORIES: readonly CategoryDef[] = [
  { id: "coffee", label: "Coffee Shops & Cafés", color: "#6f4e37", initially: true, tags: { amenity: ["cafe"], shop: ["coffee"] } },
  { id: "bakery", label: "Bakeries & Donuts", color: "#c2410c", initially: true, tags: { shop: ["bakery", "pastry"] } },
  { id: "restaurant", label: "Restaurants", color: "#be123c", initially: true, tags: { amenity: ["restaurant"] } },
  { id: "hotel", label: "Hotels", color: "#1d4ed8", initially: true, tags: { tourism: ["hotel", "motel"] } },
  { id: "college", label: "Colleges & Universities", color: "#7e22ce", initially: true, tags: { amenity: ["university", "college"] } },
  { id: "hospital", label: "Hospitals", color: "#0f766e", initially: false, tags: { amenity: ["hospital"] } },
  { id: "cinema", label: "Movie Theaters", color: "#a16207", initially: false, tags: { amenity: ["cinema"] } },
  { id: "bar", label: "Bars", color: "#9d174d", initially: false, tags: { amenity: ["bar", "pub", "biergarten"] } },
  { id: "fastfood", label: "Fast Food", color: "#b45309", initially: false, tags: { amenity: ["fast_food"] } },
  { id: "grocery", label: "Grocery Stores", color: "#15803d", initially: false, tags: { shop: ["supermarket"] } },
  { id: "convenience", label: "Convenience & Gas", color: "#475569", initially: false, tags: { shop: ["convenience"], amenity: ["fuel"] } },
  { id: "cardealer", label: "Car Dealerships", color: "#334155", initially: false, tags: { shop: ["car"] } },
];

export const PLACE_CATEGORY = new Map(PLACE_CATEGORIES.map((c) => [c.id, c]));
export const isPlaceCategory = (v: unknown): v is PlaceCategory => typeof v === "string" && PLACE_CATEGORY.has(v as PlaceCategory);
export const DEFAULT_PLACE_CATEGORIES: readonly PlaceCategory[] = PLACE_CATEGORIES.filter((c) => c.initially).map((c) => c.id);

/** Places show from this zoom in: about a 20 × 12 mile window on a laptop. Wider, a city has tens of thousands. */
export const PLACES_MIN_ZOOM = 13;
/** One request returns at most this many places; more means "zoom in for all of them". */
export const PLACES_LIMIT = 4000;

export const PLACES_SOURCE = "Places: © OpenStreetMap contributors (ODbL). Not every business is listed, and some listings are out of date.";

/** Public Overpass servers, tried in order (the first is the main one; the others are mirrors when it is busy). */
export const OVERPASS_SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter", "https://overpass.kumi.systems/api/interpreter"] as const;

export type Place = {
  /** OpenStreetMap id, e.g. "node/600491809". */
  id: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lng: number;
  /** "502 Texas Avenue", when OpenStreetMap has it. */
  street: string | null;
  city: string | null;
  zip: string | null;
  phone: string | null;
  website: string | null;
  cuisine: string | null;
  brand: string | null;
  hours: string | null;
};

const CSV_FIELDS = [
  "::type",
  "::id",
  "::lat",
  "::lon",
  "name",
  "amenity",
  "shop",
  "tourism",
  "cuisine",
  "brand",
  "addr:housenumber",
  "addr:street",
  "addr:city",
  "addr:postcode",
  "phone",
  "contact:phone",
  "website",
  "contact:website",
  "opening_hours",
] as const;

/** 4 decimals (about 10 m) is plenty for a box edge and keeps the query the same for the same box. */
const deg = (n: number) => (Math.round(n * 1e4) / 1e4).toFixed(4);

/** The Overpass query for named places of these categories in the box (CSV, so it is small). */
export function overpassQuery(b: Bounds, categories: readonly PlaceCategory[], limit = PLACES_LIMIT): string {
  const byKey: Record<string, Set<string>> = {};
  for (const id of categories) {
    const def = PLACE_CATEGORY.get(id);
    if (!def) continue;
    for (const [key, values] of Object.entries(def.tags)) for (const v of values ?? []) (byKey[key] ??= new Set()).add(v);
  }
  const box = `(${deg(b.south)},${deg(b.west)},${deg(b.north)},${deg(b.east)})`;
  const parts = Object.entries(byKey)
    .sort(([a], [c]) => a.localeCompare(c))
    .map(([key, set]) => `nwr["${key}"~"^(${[...set].sort().join("|")})$"]["name"]${box};`);
  const fields = CSV_FIELDS.map((f) => (f.startsWith("::") ? f : `"${f}"`)).join(",");
  return `[out:csv(${fields};true;"|")][timeout:25];(${parts.join("")});out center ${limit};`;
}

/** Which category a place's tags put it in (the first match in PLACE_CATEGORIES order), or null. */
export function categoryOf(tags: { amenity?: string | null; shop?: string | null; tourism?: string | null; cuisine?: string | null }): PlaceCategory | null {
  // A fast-food place that sells coffee or donuts counts as coffee or bakery (a donut shop is a prospect, a burger chain less so).
  if (tags.amenity === "fast_food" && tags.cuisine) {
    const cuisines = tags.cuisine.toLowerCase().split(/[;,]/).map((s) => s.trim());
    if (cuisines.some((c) => c === "coffee_shop" || c === "coffee")) return "coffee";
    if (cuisines.some((c) => c === "donut" || c === "donuts" || c === "bakery" || c === "kolache")) return "bakery";
  }
  for (const def of PLACE_CATEGORIES) {
    for (const [key, values] of Object.entries(def.tags)) {
      const v = tags[key as "amenity" | "shop" | "tourism"];
      if (v && values?.includes(v)) return def.id;
    }
  }
  return null;
}

const blank = (s: string | undefined) => {
  const t = (s ?? "").trim();
  return t ? t : null;
};

/** Overpass CSV ("|" separated, header first) into places. Unnamed places, and ones in no category, are skipped. */
export function parseOverpassCsv(text: string): Place[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines[0]!.split("|");
  const at = (name: string) => head.indexOf(name);
  const col = {
    type: at("@type"),
    id: at("@id"),
    lat: at("@lat"),
    lon: at("@lon"),
    name: at("name"),
    amenity: at("amenity"),
    shop: at("shop"),
    tourism: at("tourism"),
    cuisine: at("cuisine"),
    brand: at("brand"),
    num: at("addr:housenumber"),
    street: at("addr:street"),
    city: at("addr:city"),
    zip: at("addr:postcode"),
    phone: at("phone"),
    phone2: at("contact:phone"),
    web: at("website"),
    web2: at("contact:website"),
    hours: at("opening_hours"),
  };
  if (col.id < 0 || col.lat < 0 || col.lon < 0 || col.name < 0) return [];
  const out: Place[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1)) {
    const c = line.split("|");
    const get = (i: number) => (i >= 0 ? blank(c[i]) : null);
    const name = get(col.name);
    const lat = Number(get(col.lat));
    const lng = Number(get(col.lon));
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) continue;
    const category = categoryOf({ amenity: get(col.amenity), shop: get(col.shop), tourism: get(col.tourism), cuisine: get(col.cuisine) });
    if (!category) continue;
    const id = `${get(col.type) ?? "node"}/${get(col.id) ?? ""}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const num = get(col.num);
    const street = get(col.street);
    const zip = get(col.zip)?.match(/\d{5}/)?.[0] ?? null;
    out.push({
      id,
      name,
      category,
      lat,
      lng,
      street: street ? (num ? `${num} ${street}` : street) : null,
      city: get(col.city),
      zip,
      phone: get(col.phone) ?? get(col.phone2),
      website: get(col.web) ?? get(col.web2),
      cuisine: get(col.cuisine),
      brand: get(col.brand),
      hours: get(col.hours),
    });
  }
  return out;
}

/** "502 Texas Avenue, Houston 77002", or null. */
export function placeAddress(p: Pick<Place, "street" | "city" | "zip">): string | null {
  const tail = [p.city, p.zip].filter(Boolean).join(" ");
  const s = [p.street, tail].filter(Boolean).join(", ");
  return s || null;
}

/** A website that opens: OpenStreetMap sometimes leaves off the https://. Null for anything that is not a web address. */
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

export const osmUrl = (id: string) => `https://www.openstreetmap.org/${id}`;

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
  const kept = words.filter((w) => !GENERIC.has(w));
  return kept.length ? kept : words;
}

/** The same business by name: every word of the shorter name is in the longer one ("Star Cinema Grill" in "Star Cinema Grill - Cypress"). */
export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = nameTokens(a);
  const y = nameTokens(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, new Set(y)] : [y, new Set(x)];
  return short.every((w) => long.has(w));
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
 * For each place, the account it already is, if any: an account with the same name within SAME_NAME_MILES, or the same
 * street address within SAME_ADDRESS_MILES. Accounts are bucketed on a small grid so thousands of each stay quick.
 */
export function matchAccounts(places: readonly Place[], accounts: readonly AccountPoint[]): Map<string, AccountPoint> {
  const CELL = 0.01; // degrees, about 0.7 mile: a place only looks at its own cell and the ones around it
  const grid = new Map<string, AccountPoint[]>();
  const cell = (lat: number, lng: number) => `${Math.floor(lat / CELL)}:${Math.floor(lng / CELL)}`;
  for (const a of accounts) {
    const k = cell(a.lat, a.lng);
    const list = grid.get(k);
    if (list) list.push(a);
    else grid.set(k, [a]);
  }
  const out = new Map<string, AccountPoint>();
  for (const p of places) {
    const cy = Math.floor(p.lat / CELL);
    const cx = Math.floor(p.lng / CELL);
    let best: { a: AccountPoint; miles: number } | null = null;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const a of grid.get(`${cy + dy}:${cx + dx}`) ?? []) {
          const miles = milesBetween(p, a);
          const hit = (miles <= SAME_NAME_MILES && sameName(p.name, a.name)) || (miles <= SAME_ADDRESS_MILES && sameStreet(p.street, a.address));
          if (hit && (!best || miles < best.miles)) best = { a, miles };
        }
      }
    }
    if (best) out.set(p.id, best.a);
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

/** A box grown by `share` of its size on every side and snapped outward to a 0.01° grid, so small pans reuse it. */
export function padBounds(b: Bounds, share = 0.25): Bounds {
  const h = (b.north - b.south) * share;
  const w = (b.east - b.west) * share;
  const snap = 0.01;
  return {
    south: Math.max(-90, Math.floor((b.south - h) / snap) * snap),
    west: Math.floor((b.west - w) / snap) * snap,
    north: Math.min(90, Math.ceil((b.north + h) / snap) * snap),
    east: Math.ceil((b.east + w) / snap) * snap,
  };
}

export const containsBounds = (outer: Bounds, inner: Bounds) =>
  inner.south >= outer.south && inner.north <= outer.north && inner.west >= outer.west && inner.east <= outer.east;

export type PlaceFetch = { bounds: Bounds; categories: readonly PlaceCategory[] };

/** The categories still to ask for in `view`: those no earlier answer covers for the whole box. */
export function missingCategories(view: Bounds, wanted: readonly PlaceCategory[], done: readonly PlaceFetch[]): PlaceCategory[] {
  return wanted.filter((c) => !done.some((f) => f.categories.includes(c) && containsBounds(f.bounds, view)));
}

// ---------------------------------------------------------------------------------------------------------------------
// Kept in the browser: the public servers can take a minute when busy, so an answer is reused for a week

export type CachedFetch = PlaceFetch & { at: number; places: Place[] };
export const PLACE_CACHE_DAYS = 7;
export const PLACE_CACHE_MAX = 25;

/** Saved answers that still count: well formed and under a week old, newest last, at most PLACE_CACHE_MAX. */
export function readPlaceCache(raw: string | null, now: number): CachedFetch[] {
  let v: unknown;
  try {
    v = raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
  if (!Array.isArray(v)) return [];
  const fresh = v.filter(
    (e): e is CachedFetch =>
      !!e &&
      typeof e === "object" &&
      typeof (e as CachedFetch).at === "number" &&
      now - (e as CachedFetch).at < PLACE_CACHE_DAYS * 86_400_000 &&
      Array.isArray((e as CachedFetch).places) &&
      Array.isArray((e as CachedFetch).categories) &&
      (e as CachedFetch).categories.every(isPlaceCategory) &&
      !!(e as CachedFetch).bounds &&
      ["south", "west", "north", "east"].every((k) => typeof (e as CachedFetch).bounds[k as keyof Bounds] === "number"),
  );
  return fresh.slice(-PLACE_CACHE_MAX);
}

// ---------------------------------------------------------------------------------------------------------------------
// The prospect list

export const PROSPECT_COLUMNS = ["Name", "Type", "Address", "City", "ZIP", "Phone", "Website", "Latitude", "Longitude", "Nearest Account", "Its Rep", "Miles Away", "OpenStreetMap"] as const;

/** One CSV row per place, for the download. `near` gives each place's nearest account with a rep. */
export function prospectRows(places: readonly Place[], near: (p: Place) => { account: AccountPoint; miles: number } | null): string[][] {
  return places.map((p) => {
    const n = near(p);
    return [
      p.name,
      PLACE_CATEGORY.get(p.category)?.label ?? p.category,
      p.street ?? "",
      p.city ?? "",
      p.zip ?? "",
      p.phone ?? "",
      websiteUrl(p.website) ?? "",
      p.lat.toFixed(6),
      p.lng.toFixed(6),
      n?.account.name ?? "",
      n?.account.rep ?? "",
      n ? n.miles.toFixed(1) : "",
      osmUrl(p.id),
    ];
  });
}
