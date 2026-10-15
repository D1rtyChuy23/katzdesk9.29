/**
 * Address Report: accounts the map cannot place (no pin, or only a ZIP-area pin) and the other addresses KatzDesk
 * already has for them. Pure: no I/O, no DOM. The server reads the sources; this decides what to offer.
 *
 * Sources, in the order they are offered:
 * - "Geocoder match": the address the geocoder matched, when it is a street address. A ZIP-area match
 *   ("Irving, TX, 75039 (ZIP area)") is not one.
 * - "Completed from ZIP area": the typed street with the ZIP-area match's city, state and ZIP added, when the typed
 *   address has none of them (the ZIP-area match came from the same customer record, so it is a fair completion).
 * - "Clean list": the clean customer list's ship-to address for the account.
 * - "Invoice bill-to": the bill-to address saved on the account's approved invoices.
 * Suggestions equal to the current address (ignoring case, spacing, punctuation and common abbreviations) are dropped,
 * and so are repeats; the first source to offer an address keeps it.
 */

export type AddressSource = "Geocoder match" | "Completed from ZIP area" | "Clean list" | "Invoice bill-to";

export type AddressSuggestion = { address: string; source: AddressSource };

export type SuggestionInput = {
  /** The account's typed address (directory_customers.address). */
  address: string | null | undefined;
  /** The address the geocoder matched (directory_customers.geocode_address). */
  geocodeAddress: string | null | undefined;
  /** Clean-list ship-to addresses for the account, newest first. */
  cleanList?: readonly (string | null | undefined)[];
  /** Bill-to addresses on the account's invoices, newest first. */
  invoices?: readonly (string | null | undefined)[];
};

/** At most this many suggestions per account. */
export const MAX_SUGGESTIONS = 5;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 50;
/** The list request's other limits (the page reads them too, so it never sends more). */
export const MAX_PAGE_NUMBER = 100_000;
export const MAX_SEARCH_LENGTH = 200;
/** Account ids are Postgres integers: a larger ?account= is not an account. */
export const MAX_ACCOUNT_ID = 2_147_483_647;

/** Spacing tidied: single spaces, ", " between parts, no empty or trailing parts. The text itself is kept. */
export function tidyAddress(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(?:,\s*){2,}/g, ", ")
    .replace(/^[\s,]+|[\s,]+$/g, "")
    .trim();
}

// Spelled-out words and their usual abbreviations compare as the same word.
const ABBREV: Record<string, string> = {
  street: "st",
  avenue: "ave",
  av: "ave",
  road: "rd",
  boulevard: "blvd",
  drive: "dr",
  lane: "ln",
  parkway: "pkwy",
  pky: "pkwy",
  freeway: "fwy",
  highway: "hwy",
  expressway: "expy",
  court: "ct",
  place: "pl",
  circle: "cir",
  square: "sq",
  terrace: "ter",
  trail: "trl",
  suite: "ste",
  building: "bldg",
  floor: "fl",
  apartment: "apt",
  north: "n",
  south: "s",
  east: "e",
  west: "w",
  northwest: "nw",
  northeast: "ne",
  southwest: "sw",
  southeast: "se",
  texas: "tx",
};

/** Comparison key: lower case, punctuation and extra spaces gone, common words abbreviated. "TX, 77027" = "TX 77027". */
export function normalizeAddress(raw: string | null | undefined): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => ABBREV[w] ?? w)
    .join(" ");
}

/** Same address once case, spacing, punctuation and abbreviations are ignored. Two blanks are the same. */
export function sameAddress(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeAddress(a) === normalizeAddress(b);
}

/** A geocoder match that only found the ZIP code's center ("Irving, TX, 75039 (ZIP area)"). */
export function isZipAreaMatch(raw: string | null | undefined): boolean {
  return /\(\s*zip\s+area\s*\)/i.test(String(raw ?? ""));
}

export type ZipArea = { city: string | null; state: string; zip: string };

/** City, state and ZIP from a ZIP-area match. Null when it is not one, or has no state and ZIP. */
export function parseZipArea(raw: string | null | undefined): ZipArea | null {
  const s = String(raw ?? "");
  if (!isZipAreaMatch(s)) return null;
  const parts = s
    .replace(/\(\s*zip\s+area\s*\)/i, "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const zip = parts.pop() ?? "";
  if (!/^\d{5}(?:-\d{4})?$/.test(zip)) return null;
  const state = (parts.pop() ?? "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(state)) return null;
  return { city: parts.length ? parts[parts.length - 1]! : null, state, zip };
}

/** A street address: not a ZIP-area match, and the first part has a house number and a street name. */
export function isStreetAddress(raw: string | null | undefined): boolean {
  const s = tidyAddress(raw);
  if (!s || isZipAreaMatch(s)) return false;
  const first = s.split(",")[0]!.trim();
  return /\d/.test(first) && /[a-z]/i.test(first);
}

/** The geocoder's matched address in the typed form: "…, HOUSTON, TX, 77027" → "…, HOUSTON, TX 77027". */
export function geocoderAddress(raw: string | null | undefined): string {
  return tidyAddress(raw).replace(/,\s*([A-Za-z]{2}),\s*(\d{5}(?:-\d{4})?)$/, ", $1 $2");
}

const STATE_NAMES: Record<string, string> = { TX: "Texas" };
const UNIT_WORDS = /^(?:suite|ste|unit|apt|apartment|bldg|building|floor|fl|room|rm|dept|attn|c\/o|p\.?\s*o\.?\s*box|po box|#)(?:\b|\s|$)/i;
const cityKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

/** A part that reads like a city: letters only, not a suite, unit or note. */
function cityLike(part: string): boolean {
  return /[a-z]/i.test(part) && !/\d/.test(part) && !UNIT_WORDS.test(part.trim());
}

/** The typed address starts with a street: a number, or at least two words ("NRG Parkway"). */
function streetLike(part: string): boolean {
  const p = part.trim();
  return /[a-z]/i.test(p) && (/\d/.test(p) || p.split(/\s+/).length >= 2);
}

/** The words of `text` end with the words of `city` ("Suite 250 Houston" ends with "Houston"). */
function endsWithCity(text: string, city: string): boolean {
  const words = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const t = words(text);
  const c = words(city);
  return c.length > 0 && t.length >= c.length && c.every((w, i) => t[t.length - c.length + i] === w);
}

/**
 * The typed street completed with the ZIP-area match's city, state and ZIP, when the typed address is missing them.
 * - Already ends in a ZIP: nothing to complete.
 * - Ends in the same state ("…, Irving, TX"): the ZIP is added.
 * - Ends in the same city ("…, Irving"): state and ZIP are added.
 * - Ends in a different city: null, a person should look (the city and the ZIP disagree).
 * - No commas but ends in the state ("123 Main St Irving TX"): the city cannot be told apart from the street, so only
 *   the ZIP is added, and only when the words before the state end in the ZIP area's city; otherwise null.
 * - Street only ("501 W. Las Colinas Blvd.", "…, Suite 150"): city, state and ZIP are added.
 */
export function completeFromZipArea(typed: string | null | undefined, geocodeAddress: string | null | undefined): string | null {
  const area = parseZipArea(geocodeAddress);
  const t = tidyAddress(typed);
  if (!area || !t) return null;
  if (/\b\d{5}(?:-\d{4})?$/.test(t)) return null;
  const parts = t.split(", ");
  if (!streetLike(parts[0]!)) return null;
  const tail = `${area.state} ${area.zip}`;
  const sameCity = (c: string) => !area.city || cityKey(c) === cityKey(area.city);
  const last = parts[parts.length - 1]!;
  const names = [area.state, STATE_NAMES[area.state]].filter((n): n is string => !!n).join("|");
  const state = new RegExp(`^(?:(.*\\S)\\s+)?(?:${names})$`, "i").exec(last);
  if (parts.length === 1) {
    if (state) return state[1] && area.city && endsWithCity(state[1], area.city) ? `${t} ${area.zip}` : null;
    return area.city ? `${t}, ${area.city}, ${tail}` : `${t}, ${tail}`;
  }
  if (state) {
    let city: string | null = null;
    if (state[1]) {
      // Words before the state in the same part: a city ("Irving TX"), a suite then the city ("Suite 250 Houston
      // Texas"), or only a suite number ("Suite 250 TX"). Anything else could be another city: a person looks.
      if (cityLike(state[1])) city = state[1];
      else if (area.city && endsWithCity(state[1], area.city)) city = area.city;
      else if (!/\d/.test(state[1].split(" ").pop()!)) return null;
    } else if (parts.length >= 3 && cityLike(parts[parts.length - 2]!)) {
      city = parts[parts.length - 2]!;
    }
    if (city && !sameCity(city)) return null;
    const head = state[1] ? [...parts.slice(0, -1), state[1]] : parts.slice(0, -1);
    if (!city && area.city) head.push(area.city);
    return [...head, tail].join(", ");
  }
  if (cityLike(last)) return sameCity(last) ? `${t}, ${tail}` : null;
  return area.city ? `${t}, ${area.city}, ${tail}` : `${t}, ${tail}`;
}

/** Every word of `a` is in `b` (so offering `a` instead of `b` would only drop words, such as a suite). */
function onlyDropsWords(a: string, b: string): boolean {
  const have = new Set(normalizeAddress(b).split(" ").filter(Boolean));
  const words = normalizeAddress(a).split(" ").filter(Boolean);
  return have.size > 0 && words.length > 0 && words.every((w) => have.has(w));
}

/** The addresses to offer for one account, best first. See the top of this file for the sources. */
export function buildSuggestions(input: SuggestionInput): AddressSuggestion[] {
  const current = tidyAddress(input.address);
  const out: AddressSuggestion[] = [];
  const seen = new Set<string>([normalizeAddress(current)]);
  const offer = (address: string, source: AddressSource) => {
    const a = tidyAddress(address);
    const key = normalizeAddress(a);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push({ address: a, source });
  };
  const geo = input.geocodeAddress;
  if (isStreetAddress(geo)) {
    const g = geocoderAddress(geo);
    // A match that only leaves words out of the typed address (a suite, a unit) would lose them: not offered.
    if (!current || !onlyDropsWords(g, current)) offer(g, "Geocoder match");
  } else if (isZipAreaMatch(geo)) {
    const done = completeFromZipArea(current, geo);
    if (done) offer(done, "Completed from ZIP area");
  }
  for (const a of input.cleanList ?? []) if (a) offer(a, "Clean list");
  for (const a of input.invoices ?? []) if (a) offer(a, "Invoice bill-to");
  return out.slice(0, MAX_SUGGESTIONS);
}

/** Search box text → up to six words for a LIKE search. */
export function searchWords(raw: string | null | undefined): string[] {
  return String(raw ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);
}

/** A word as a LIKE pattern that matches it anywhere, with %, _ and \ taken literally. */
export function likePattern(word: string): string {
  return `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Number of pages for `total` rows (at least 1, so an empty list is "Page 1 of 1"). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)));
}
