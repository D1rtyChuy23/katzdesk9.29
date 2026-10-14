/**
 * Geography helpers for the customer map, Planner routes, Nearby and territories. Pure: no I/O, no DOM.
 * Distances are straight-line miles (great-circle). Nothing here pretends to know drive times.
 */

export type LatLng = { lat: number; lng: number };
export type PinQuality = "exact" | "close" | "approx";

const EARTH_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** A usable map point: both numbers present, in range, and not the 0,0 "null island" placeholder. */
export function isPoint(p: { lat?: number | null; lng?: number | null } | null | undefined): p is LatLng {
  if (!p) return false;
  const { lat, lng } = p;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/** Straight-line distance in miles. */
export function milesBetween(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "0.4 mi", "3.2 mi", "18 mi". */
export function milesLabel(mi: number): string {
  if (!Number.isFinite(mi)) return "";
  if (mi < 10) return `${(Math.round(mi * 10) / 10).toFixed(1)} mi`;
  return `${Math.round(mi)} mi`;
}

/** A pin is good enough to drive to: the street address was found (exact or close), not just the ZIP area. */
export function canDriveTo(quality: PinQuality | null | undefined): boolean {
  return quality === "exact" || quality === "close";
}

// ---------------------------------------------------------------------------------------------------------------
// Nearby

export type NearbyRow<T> = { item: T; miles: number };

/**
 * Everything within `radiusMiles` of `origin`, nearest first. `pointOf` returns null for items with no pin; those
 * are skipped. `exclude` drops the origin itself (or anything else). Ties sort by `tieKey` so the order is stable.
 */
export function nearby<T>(
  origin: LatLng,
  items: readonly T[],
  pointOf: (item: T) => LatLng | null,
  radiusMiles: number,
  opts: { exclude?: (item: T) => boolean; tieKey?: (item: T) => string; limit?: number } = {},
): NearbyRow<T>[] {
  // Cheap box first: one degree of latitude is ~69 miles; longitude shrinks with latitude.
  const dLat = radiusMiles / 69;
  const dLng = radiusMiles / (69 * Math.max(0.2, Math.cos(rad(origin.lat))));
  const out: NearbyRow<T>[] = [];
  for (const item of items) {
    if (opts.exclude?.(item)) continue;
    const p = pointOf(item);
    if (!isPoint(p)) continue;
    if (Math.abs(p.lat - origin.lat) > dLat || Math.abs(p.lng - origin.lng) > dLng) continue;
    const miles = milesBetween(origin, p);
    if (miles <= radiusMiles) out.push({ item, miles });
  }
  out.sort((a, b) => a.miles - b.miles || (opts.tieKey ? opts.tieKey(a.item).localeCompare(opts.tieKey(b.item)) : 0));
  return opts.limit ? out.slice(0, opts.limit) : out;
}

// ---------------------------------------------------------------------------------------------------------------
// Areas: group pins that are close together, named by their most common city.

/** City from a Census matched address ("4444 WESTHEIMER RD, HOUSTON, TX, 77027") or a typed one ("…, Houston, TX 77027"). */
export function cityFromAddress(address: string | null | undefined): string | null {
  const parts = String(address ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  // Census form: street, city, ST, ZIP  →  city is third from the end.
  const last = parts[parts.length - 1]!;
  if (/^\d{5}(-\d{4})?$/.test(last) && parts.length >= 4 && /^[A-Za-z]{2}$/.test(parts[parts.length - 2]!)) return titleCase(parts[parts.length - 3]!);
  // Typed form: street, city, ST 77027  →  city is second from the end.
  if (/^[A-Za-z]{2}\s+\d{5}/.test(last) && parts.length >= 3) return titleCase(parts[parts.length - 2]!);
  return null;
}

function titleCase(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return t;
  if (t !== t.toUpperCase()) return t;
  return t.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\bMc([a-z])/g, (_, c: string) => `Mc${c.toUpperCase()}`);
}

export type Area<T> = { key: string; label: string; center: LatLng; items: T[] };

/**
 * Groups items whose pins are within `radiusMiles` of a group's center (greedy, deterministic: densest seeds first,
 * then by `tieKey`). Each group is labelled by its most common city ("Katy", "Sugar Land") and, when two groups share
 * a city, a compass hint ("Houston · NW"). Items with no pin come back in `unplaced`.
 */
export function groupByArea<T>(
  items: readonly T[],
  pointOf: (item: T) => LatLng | null,
  cityOf: (item: T) => string | null,
  opts: { radiusMiles?: number; tieKey?: (item: T) => string } = {},
): { areas: Area<T>[]; unplaced: T[] } {
  const radius = opts.radiusMiles ?? 5;
  const tie = opts.tieKey ?? (() => "");
  const placed: { item: T; p: LatLng }[] = [];
  const unplaced: T[] = [];
  for (const item of items) {
    const p = pointOf(item);
    if (isPoint(p)) placed.push({ item, p });
    else unplaced.push(item);
  }
  // Spatial grid with cells about `radius` wide, so neighbours are found in the 3 × 3 cells around a point instead of
  // by comparing every pair (2,600 accounts: ~10 ms instead of ~400 ms).
  const lat0 = placed.length ? placed.reduce((s, x) => s + x.p.lat, 0) / placed.length : 0;
  const cellLat = radius / 69;
  const cellLng = radius / (69 * Math.max(0.2, Math.cos(rad(lat0))));
  const cellOf = (p: LatLng) => [Math.floor(p.lat / cellLat), Math.floor(p.lng / cellLng)] as const;
  const grid = new Map<string, number[]>();
  placed.forEach((x, i) => {
    const [cy, cx] = cellOf(x.p);
    const k = `${cy}:${cx}`;
    const list = grid.get(k);
    if (list) list.push(i);
    else grid.set(k, [i]);
  });
  const near = (i: number) => {
    const [cy, cx] = cellOf(placed[i]!.p);
    const out: number[] = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++)
        for (const j of grid.get(`${cy + dy}:${cx + dx}`) ?? []) if (milesBetween(placed[i]!.p, placed[j]!.p) <= radius) out.push(j);
    return out;
  };
  // Seed order: the point with the most neighbours first, so groups form around dense spots.
  const neighbours = placed.map((_, i) => near(i));
  const density = neighbours.map((n) => n.length);
  const order = placed.map((_, i) => i).sort((i, j) => density[j]! - density[i]! || tie(placed[i]!.item).localeCompare(tie(placed[j]!.item)) || i - j);
  const rank = new Map(order.map((i, r) => [i, r]));
  const taken = new Set<number>();
  const groups: { members: number[]; center: LatLng }[] = [];
  for (const seed of order) {
    if (taken.has(seed)) continue;
    const members = neighbours[seed]!.filter((i) => !taken.has(i)).sort((a, b) => rank.get(a)! - rank.get(b)!);
    members.forEach((i) => taken.add(i));
    const center = {
      lat: members.reduce((s, i) => s + placed[i]!.p.lat, 0) / members.length,
      lng: members.reduce((s, i) => s + placed[i]!.p.lng, 0) / members.length,
    };
    groups.push({ members, center });
  }
  const overall = placed.length
    ? { lat: placed.reduce((s, x) => s + x.p.lat, 0) / placed.length, lng: placed.reduce((s, x) => s + x.p.lng, 0) / placed.length }
    : null;
  const labelled = groups.map((g) => {
    const counts = new Map<string, number>();
    for (const i of g.members) {
      const c = cityOf(placed[i]!.item);
      if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    const city = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "Area";
    return { ...g, city };
  });
  const cityUses = new Map<string, number>();
  for (const g of labelled) cityUses.set(g.city, (cityUses.get(g.city) ?? 0) + 1);
  const areas = labelled.map((g, n) => {
    const hint = (cityUses.get(g.city) ?? 0) > 1 && overall ? compass(overall, g.center) : "";
    const label = hint ? `${g.city} · ${hint}` : g.city;
    return { key: `area-${n}`, label, center: g.center, items: g.members.map((i) => placed[i]!.item) };
  });
  // Same label twice (same city, same direction): number them so they stay distinct.
  const seen = new Map<string, number>();
  for (const a of areas) {
    const k = a.label;
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    if (c > 1) a.label = `${k} ${c}`;
  }
  return { areas, unplaced };
}

/** Eight-way compass direction from `from` to `to` ("N", "NE", …). */
export function compass(from: LatLng, to: LatLng): string {
  const y = Math.sin(rad(to.lng - from.lng)) * Math.cos(rad(to.lat));
  const x = Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) - Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(rad(to.lng - from.lng));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(deg / 45) % 8]!;
}

// ---------------------------------------------------------------------------------------------------------------
// Stop order for one tech's day

export type Stop<T> = { item: T; point: LatLng | null; time: string | null };

/** Total straight-line miles along `points`, starting at `start` when given. */
export function pathMiles(points: readonly LatLng[], start?: LatLng | null): number {
  let total = 0;
  let prev = start ?? null;
  for (const p of points) {
    if (prev) total += milesBetween(prev, p);
    prev = p;
  }
  return total;
}

/**
 * Suggested order for a day's stops.
 * - Stops with a set time keep their time order (a customer was promised that time).
 * - Stops without a time are slotted where they add the fewest straight-line miles (cheapest insertion), then the
 *   untimed run is tidied with 2-opt where that does not move any timed stop.
 * - Stops with no pin cannot be placed on a route and come back in `unrouted`, in their original order.
 * `start` is where the day begins (optional; without it the first stop is the start).
 */
export function orderStops<T>(stops: readonly Stop<T>[], start?: LatLng | null): { ordered: Stop<T>[]; unrouted: Stop<T>[]; miles: number } {
  const unrouted = stops.filter((s) => !isPoint(s.point));
  const routable = stops.filter((s) => isPoint(s.point)) as (Stop<T> & { point: LatLng })[];
  const timed = routable.filter((s) => s.time).sort((a, b) => a.time!.localeCompare(b.time!));
  const free = routable.filter((s) => !s.time);
  const route: (Stop<T> & { point: LatLng })[] = [...timed];
  const fixed = new Set<Stop<T>>(timed);
  const legCost = (seq: (Stop<T> & { point: LatLng })[], i: number, p: LatLng) => {
    // cost of inserting p between seq[i-1] (or start) and seq[i] (or end)
    const before = i > 0 ? seq[i - 1]!.point : start ?? null;
    const after = i < seq.length ? seq[i]!.point : null;
    const add = (before ? milesBetween(before, p) : 0) + (after ? milesBetween(p, after) : 0);
    const removed = before && after ? milesBetween(before, after) : 0;
    return add - removed;
  };
  // Insert the free stop that is cheapest to add first, repeatedly (deterministic: ties keep input order).
  const pending = [...free];
  while (pending.length) {
    let best = { cost: Infinity, k: 0, at: 0 };
    pending.forEach((s, k) => {
      for (let i = 0; i <= route.length; i++) {
        const c = legCost(route, i, s.point);
        if (c < best.cost - 1e-9) best = { cost: c, k, at: i };
      }
    });
    const [s] = pending.splice(best.k, 1);
    route.splice(best.at, 0, s!);
  }
  // 2-opt on stretches with no timed stop inside, so promised times keep their order.
  const total = () => pathMiles(route.map((s) => s.point), start);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 200) {
    improved = false;
    for (let i = 0; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const segment = route.slice(i, j + 1);
        if (segment.some((s) => fixed.has(s))) continue;
        const before = total();
        const reversed = [...route.slice(0, i), ...segment.reverse(), ...route.slice(j + 1)];
        const after = pathMiles(reversed.map((s) => s.point), start);
        if (after < before - 1e-6) {
          route.splice(0, route.length, ...reversed);
          improved = true;
        }
      }
    }
  }
  return { ordered: route, unrouted, miles: total() };
}

// ---------------------------------------------------------------------------------------------------------------
// Links that open in Google Maps (no API key needed; they open the Maps app on a phone).

const fmt = (p: LatLng) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;

/** Directions to a pin when it is a real street match, otherwise to the typed address. Null when neither exists. */
export function directionsUrl(target: { point?: LatLng | null; quality?: PinQuality | null; address?: string | null }): string | null {
  if (isPoint(target.point) && canDriveTo(target.quality)) return `https://www.google.com/maps/dir/?api=1&destination=${fmt(target.point)}`;
  const a = String(target.address ?? "").trim();
  return a ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(a)}` : null;
}

/** Show a pin (or address) on the map, not directions. */
export function placeUrl(target: { point?: LatLng | null; quality?: PinQuality | null; address?: string | null }): string | null {
  if (isPoint(target.point) && canDriveTo(target.quality)) return `https://www.google.com/maps/search/?api=1&query=${fmt(target.point)}`;
  const a = String(target.address ?? "").trim();
  if (a) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}`;
  return isPoint(target.point) ? `https://www.google.com/maps/search/?api=1&query=${fmt(target.point)}` : null;
}

/** Google Maps allows up to 9 stops between the start and the end of one link. */
export const MAX_WAYPOINTS = 9;

/** A route stop for a Google Maps link: a pin, or a typed address when the pin is only approximate. */
export type RouteStop = LatLng | string;
const stopParam = (s: RouteStop) => (typeof s === "string" ? s.trim() : fmt(s));

/**
 * One or more Google Maps route links covering `stops` in order. Without `origin` Google starts from the phone's
 * current location. Long days are split into legs of at most 11 stops (origin + 9 waypoints + destination), each leg
 * starting where the previous one ended. A stop can be a pin or an address string.
 */
export function routeUrls(stops: readonly RouteStop[], origin?: RouteStop | null): string[] {
  const list = stops.filter((s) => (typeof s === "string" ? s.trim() !== "" : isPoint(s)));
  if (!list.length) return [];
  const urls: string[] = [];
  let from: RouteStop | null = origin ?? null;
  let i = 0;
  while (i < list.length) {
    const leg = list.slice(i, i + MAX_WAYPOINTS + 1); // waypoints + destination per leg
    const dest = leg[leg.length - 1]!;
    const via = leg.slice(0, -1);
    const q = new URLSearchParams({ api: "1", destination: stopParam(dest), travelmode: "driving" });
    if (from) q.set("origin", stopParam(from));
    if (via.length) q.set("waypoints", via.map(stopParam).join("|"));
    urls.push(`https://www.google.com/maps/dir/?${q.toString().replace(/%2C/g, ",").replace(/%7C/g, "|")}`);
    from = dest;
    i += leg.length;
  }
  return urls;
}

// ---------------------------------------------------------------------------------------------------------------
// Territories

/**
 * For an account with no rep, the rep whose accounts sit closest: the rep with the most accounts within
 * `radiusMiles`, ties broken by the nearest single account, then by name. Null when no rep has an account that close.
 */
export function suggestRep<T>(
  origin: LatLng,
  items: readonly T[],
  pointOf: (item: T) => LatLng | null,
  repOf: (item: T) => string | null,
  radiusMiles = 5,
): { rep: string; count: number; nearestMiles: number } | null {
  const byRep = new Map<string, { count: number; nearest: number }>();
  for (const row of nearby(origin, items, pointOf, radiusMiles)) {
    const rep = repOf(row.item);
    if (!rep) continue;
    const cur = byRep.get(rep) ?? { count: 0, nearest: Infinity };
    cur.count += 1;
    cur.nearest = Math.min(cur.nearest, row.miles);
    byRep.set(rep, cur);
  }
  const best = [...byRep.entries()].sort((a, b) => b[1].count - a[1].count || a[1].nearest - b[1].nearest || a[0].localeCompare(b[0]))[0];
  return best ? { rep: best[0], count: best[1].count, nearestMiles: best[1].nearest } : null;
}

/** Center and typical spread (median miles from center) of a set of pins. */
export function spread(points: readonly LatLng[]): { center: LatLng; medianMiles: number } | null {
  const pts = points.filter(isPoint);
  if (!pts.length) return null;
  const center = { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length };
  const d = pts.map((p) => milesBetween(center, p)).sort((a, b) => a - b);
  const mid = Math.floor(d.length / 2);
  return { center, medianMiles: d.length % 2 ? d[mid]! : (d[mid - 1]! + d[mid]!) / 2 };
}

/**
 * Stable color per rep from a fixed palette (same rep, same color on every page). Index by the rep's position in the
 * sorted rep list so the palette is used evenly; "No rep" always uses the neutral slot.
 */
export const REP_PALETTE = ["#2563eb", "#d97706", "#059669", "#db2777", "#7c3aed", "#0891b2", "#dc2626", "#65a30d", "#c2410c", "#4f46e5", "#0d9488", "#a21caf"] as const;
export const NO_REP_COLOR = "#78716c";
export function repColors(reps: readonly string[]): Map<string, string> {
  const sorted = [...new Set(reps.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  return new Map(sorted.map((r, i) => [r, REP_PALETTE[i % REP_PALETTE.length]!]));
}
