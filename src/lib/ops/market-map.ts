/**
 * The Map's Population layer (Chuy, 11/26): one circle per ZIP code area, sized by how many people live there and
 * colored by how crowded it is, with Census figures for the card. The data is public U.S. Census Bureau data built by
 * scripts/build-zip-stats.mjs into src/lib/ops/census/zip-stats.txt (no customer data). Pure: safe for node --test and the
 * screens.
 */

export type ZipStat = {
  zip: string;
  /** The ZIP area's inside point (Census "internal point"), not a post office. */
  lat: number;
  lng: number;
  /** Land area in square miles. */
  sqmi: number;
  population: number;
  /** Median household income in dollars; null when Census has no estimate (few households). */
  income: number | null;
  /** Business locations with employees (County Business Patterns 2022). */
  businesses: number;
  /** Coffee shops and snack bars (NAICS 722515). */
  cafes: number;
  /** Restaurants other than coffee and snack bars. */
  restaurants: number;
  bars: number;
  hotels: number;
};

export type Bounds = { south: number; west: number; north: number; east: number };

/** Where the figures come from, for the card and the layer's key. */
export const ZIP_SOURCE =
  "U.S. Census Bureau: population and income from the 2019–2023 American Community Survey (5-year); business counts from County Business Patterns 2022 (places with employees, not government).";

/** The Population layer shows from this zoom in (below it a state has thousands of overlapping circles). */
export const ZIP_MIN_ZOOM = 7;
/** At most this many ZIP circles at once (the most populated ones in view). */
export const ZIP_LIMIT = 2500;

/**
 * How many ZIP circles to ask for at a zoom, and the grid the asked-for box snaps to. Zoomed out to a state, a few
 * hundred of the biggest are what reads (and keeps a phone's answer small); a coarse grid lets a pan reuse the answer.
 */
export function zipRequest(zoom: number): { limit: number; snap: number } {
  if (zoom < 8) return { limit: 600, snap: 1 };
  if (zoom < 9) return { limit: 1000, snap: 0.5 };
  if (zoom < 10) return { limit: 1500, snap: 0.25 };
  if (zoom < 12) return { limit: ZIP_LIMIT, snap: 0.1 };
  return { limit: ZIP_LIMIT, snap: 0.02 };
}

const num = (s: string | undefined) => {
  const n = Number(s);
  return s != null && s !== "" && Number.isFinite(n) ? n : null;
};

/** zip-stats.txt (tab separated, header first) into rows. Lines that do not parse are skipped. */
export function parseZipStats(text: string): ZipStat[] {
  const out: ZipStat[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const c = lines[i]!.split("\t");
    if (c.length < 11) continue;
    const lat = num(c[1]);
    const lng = num(c[2]);
    const population = num(c[4]);
    if (!/^\d{5}$/.test(c[0]!) || lat == null || lng == null || population == null) continue;
    out.push({
      zip: c[0]!,
      lat,
      lng,
      sqmi: num(c[3]) ?? 0,
      population,
      income: num(c[5]),
      businesses: num(c[6]) ?? 0,
      cafes: num(c[7]) ?? 0,
      restaurants: num(c[8]) ?? 0,
      bars: num(c[9]) ?? 0,
      hotels: num(c[10]) ?? 0,
    });
  }
  return out;
}

/** A box that makes sense, or null (south above north, or not numbers). East may be less than west across the date line. */
export function cleanBounds(b: Partial<Bounds> | null | undefined): Bounds | null {
  if (!b) return null;
  const { south, west, north, east } = b;
  if (![south, west, north, east].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  if (south! > north! || south! < -90 || north! > 90) return null;
  return { south: south!, west: west!, north: north!, east: east! };
}

export function inBounds(p: { lat: number; lng: number }, b: Bounds): boolean {
  if (p.lat < b.south || p.lat > b.north) return false;
  return b.west <= b.east ? p.lng >= b.west && p.lng <= b.east : p.lng >= b.west || p.lng <= b.east;
}

/** The ZIP areas inside the box, most people first, at most `limit`. Empty areas (no one lives there) are left out. */
export function zipsIn(stats: readonly ZipStat[], b: Bounds, limit = ZIP_LIMIT): { zips: ZipStat[]; truncated: boolean } {
  const hits = stats.filter((z) => z.population > 0 && inBounds(z, b));
  hits.sort((a, c) => c.population - a.population || a.zip.localeCompare(c.zip));
  return { zips: hits.slice(0, limit), truncated: hits.length > limit };
}

/** People per square mile of land, or null for an area too small to measure (a single building's ZIP). */
export function density(z: Pick<ZipStat, "population" | "sqmi">): number | null {
  return z.sqmi >= 0.05 ? z.population / z.sqmi : null;
}

/** People per square mile, lightest to darkest. Colors are a yellow-to-red ramp that reads on the street map. */
export const DENSITY_STEPS: readonly { below: number; color: string; label: string }[] = [
  { below: 500, color: "#fde68a", label: "Under 500" },
  { below: 2_000, color: "#fbbf24", label: "500–2,000" },
  { below: 5_000, color: "#f97316", label: "2,000–5,000" },
  { below: 10_000, color: "#dc2626", label: "5,000–10,000" },
  { below: Infinity, color: "#7f1d1d", label: "10,000+" },
];

export function densityColor(d: number | null): string {
  if (d == null) return DENSITY_STEPS[2]!.color;
  return (DENSITY_STEPS.find((s) => d < s.below) ?? DENSITY_STEPS[DENSITY_STEPS.length - 1]!).color;
}

/** Circle radius in pixels: area grows with population, from 4 px to 22 px (60,000 people or more). */
export function zipRadius(population: number): number {
  const k = Math.sqrt(Math.max(0, population) / 60_000);
  return Math.round((4 + 18 * Math.min(1, k)) * 10) / 10;
}

/**
 * The ZIP code in an address ("…, Houston, TX 77002-1234" → "77002"): five digits after a state, else five digits that
 * end the address. A street number ("12345 Main St") is not a ZIP. Null when there is none.
 */
export function zipFromAddress(address: string | null | undefined): string | null {
  const s = String(address ?? "");
  const afterState = [...s.matchAll(/\b[A-Za-z]{2}\.?,?\s+(\d{5})(?:-\d{4})?\b/g)].pop();
  if (afterState) return afterState[1]!;
  const atEnd = s.match(/\b(\d{5})(?:-\d{4})?\s*(?:,?\s*(?:USA?|United States))?\s*$/i);
  return atEnd ? atEnd[1]! : null;
}

/** "19,616". */
export const count = (n: number) => Math.round(n).toLocaleString("en-US");
/** "$85,436", or "No estimate". */
export const dollars = (n: number | null) => (n == null ? "No estimate" : `$${Math.round(n).toLocaleString("en-US")}`);
