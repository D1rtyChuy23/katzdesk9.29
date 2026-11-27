/**
 * Web Check (Chuy, 11/27): is each customer's address still current? Each account is compared with the business
 * listings bundled for Prospects (Overture Maps places, src/lib/ops/places-tiles/, refreshed monthly), including the
 * ones Overture marks permanently closed:
 *
 * - same:      listed under our name at our pin, at our street address.
 * - different: listed under our name at our pin, at another street address (one of the two is out of date).
 * - closed:    listed under our name at our pin, and marked permanently closed, with no open listing nearby.
 * - elsewhere: not listed at our pin, but listed under our name somewhere else within ELSEWHERE_MILES: it may have
 *              moved, or our pin may be wrong. Only for a name with at most CHAIN_LIMIT open listings around (a chain's
 *              other stores say nothing about ours), and only a listing whose name adds no words to ours.
 * - none:      no listing under our name around. Not proof of anything: the listings cover the Prospects types
 *              (restaurants, cafés, hotels, offices...) in Texas only, and not every business is in them.
 * - nopin:     the account has no map pin, so there is nowhere to look (the Address Report's Open list is for those).
 *
 * Pure: safe for node --test and the screens.
 */
import { milesBetween, type LatLng } from "./geo.ts";
import { nameTokens, placeAddress, type Place } from "./places.ts";
import { normalizeAddress, tidyAddress } from "./address-report.ts";

export type WebStatus = "same" | "different" | "closed" | "elsewhere" | "none" | "nopin";

export type WebCheck = {
  status: WebStatus;
  /** The listing the status is about (the open one at our pin, the closed one, or the one elsewhere). */
  place: Place | null;
  /** Miles from our pin to that listing. */
  miles: number | null;
  /** The listing's address in our format ("502 Texas Ave, Houston, TX 77002"), when it has a street. */
  listedAddress: string | null;
  /**
   * Whether the listing's street address is ours (house number and street); null when either side has none. Listed
   * elsewhere at our own address means the address is right and the map pin is off.
   */
  sameAddress: boolean | null;
};

/** Our pin and the listing this close (miles) are the same place: one block, to allow for where each map put it. */
export const HERE_MILES = 0.15;
/** How far to look for the same name when it is not at our pin: a street pin is trusted more than a ZIP-area one. */
export const ELSEWHERE_MILES = 25;
export const ELSEWHERE_MILES_STREET_PIN = 10;
/** More open listings than this under one name around: a chain, so "elsewhere" cannot be told. */
export const CHAIN_LIMIT = 2;

export const WEB_STATUS_LABEL: Record<WebStatus, string> = {
  same: "Listed at this address",
  different: "Listed at another address",
  closed: "Listed as permanently closed",
  elsewhere: "Listed somewhere else",
  none: "No listing found",
  nopin: "No map pin",
};

/**
 * A listing's address the way our accounts write them, tidied the way the Address Report offers it: "502 Texas Ave,
 * Houston, TX 77002". Null unless the street starts with a house number: a listing without one is never offered.
 */
export function listedAddress(p: Pick<Place, "street" | "city" | "zip">): string | null {
  if (!p.street || streetKey(p.street) == null) return null;
  const tail = [p.city, ["TX", p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return tidyAddress([p.street, tail].filter(Boolean).join(", "));
}

// ---------------------------------------------------------------------------------------------------------------------
// Names: strict, because a match can lead an Admin to change an address

/** Words that say nothing about which business it is, on top of the generic ones nameTokens drops ("La", "El", "de"). */
const FILLER = new Set(["la", "el", "los", "las", "le", "les", "de", "del", "di", "da", "y"]);

/** An account's name without the location we add after " - ", " @ ", " | " or "(": "Black Rock - Pearland" → "Black Rock". */
export function baseName(name: string | null | undefined): string {
  return String(name ?? "").split(/\s+[-–—@|]\s+|\s*\(/)[0]!.trim();
}

/** The words that tell one business from another. */
export function businessWords(name: string | null | undefined): string[] {
  const words = nameTokens(name);
  const kept = words.filter((w) => !FILLER.has(w));
  return kept.length ? kept : words;
}

/**
 * The same business by name: the listing's distinguishing words are ours, in order, after our location suffix and
 * the generic words are set aside ("Black Rock Coffee Bar" is "Black Rock - Pearland"; "La Bar" is not "La Sicilia
 * Italian Bakery & Cafe"; "Hugo's Cocina" is not "Hugo's"). One word must be at least five letters to count.
 */
export function sameBusiness(listingName: string | null | undefined, accountName: string | null | undefined): boolean {
  const ours = businessWords(baseName(accountName));
  const theirs = businessWords(baseName(listingName));
  if (!ours.length || ours.length !== theirs.length || !ours.every((w, i) => w === theirs[i])) return false;
  return ours.length >= 2 || ours[0]!.length >= 5;
}

// ---------------------------------------------------------------------------------------------------------------------
// Streets

const ROUTE: Record<string, string> = { fm: "fm", farm: "fm", interstate: "i", i: "i", ih: "i", hwy: "hwy", sh: "hwy", us: "hwy", state: "hwy", cr: "cr", county: "cr" };
const DIRECTIONS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);

/**
 * House number and street, for comparing two addresses: "502 Texas Ave" and "502 N Texas Avenue, Houston" are both
 * "502 texas"; "1234 Farm to Market 1960" and "1234 FM 1960 Rd" are "1234 fm 1960". Null when the address does not
 * start with a house number ("Southwest Fwy", "One University Way", "The Galleria, 5015 Westheimer Rd").
 */
export function streetKey(address: string | null | undefined): string | null {
  const words = normalizeAddress(String(address ?? "").split(",")[0]).split(" ").filter(Boolean);
  const num = words[0]?.match(/^(\d+)[a-z]?$/)?.[1];
  if (!num) return null;
  let i = 1;
  // "502-A" and "215-294" (a range) normalize to "502 a" and "215 294": the second part is not the street.
  if (words[i] && /^(\d+|[a-z])$/.test(words[i]!) && words[i + 1] && !ROUTE[words[i]!]) i++;
  while (words[i] && DIRECTIONS.has(words[i]!)) i++;
  const w = words[i];
  if (!w) return null;
  const route = ROUTE[w];
  if (route) {
    // "farm to market 1960", "state highway 6", "county road 12": the route number is what tells it apart.
    let j = i + 1;
    while (words[j] && !/^\d/.test(words[j]!) && j < i + 4) j++;
    return words[j] ? `${num} ${route} ${words[j]}` : `${num} ${route}`;
  }
  return `${num} ${w}`;
}

/** Whether two addresses are the same street address; null when either has no house number to compare. */
export function sameStreetAddress(a: string | null | undefined, b: string | null | undefined): boolean | null {
  const x = streetKey(a);
  const y = streetKey(b);
  return x == null || y == null ? null : x === y;
}

export type WebAccount = { name: string; lat: number | null; lng: number | null; address: string | null; approx?: boolean };

/**
 * The check for one account. `candidates` are the listings around it (any name; the server passes the ones sharing the
 * name's first word nearby).
 */
export function webCheck(account: WebAccount, candidates: readonly Place[]): WebCheck {
  const none = (status: WebStatus): WebCheck => ({ status, place: null, miles: null, listedAddress: null, sameAddress: null });
  if (account.lat == null || account.lng == null) return none("nopin");
  const pin: LatLng = { lat: account.lat, lng: account.lng };
  const reach = account.approx ? ELSEWHERE_MILES : ELSEWHERE_MILES_STREET_PIN;
  const named = candidates
    .filter((p) => sameBusiness(p.name, account.name))
    .map((p) => ({ p, miles: milesBetween(pin, p), street: account.address && p.street ? sameStreetAddress(p.street, account.address) : null }))
    .filter((x) => x.miles <= reach)
    // Open before closed, then a listing on our street before a nearer one on another, then nearest.
    .sort((a, b) => Number(a.p.closed) - Number(b.p.closed) || Number(b.street === true) - Number(a.street === true) || a.miles - b.miles);
  const found = (status: WebStatus, x: { p: Place; miles: number; street: boolean | null }): WebCheck => ({
    status,
    place: x.p,
    miles: Math.round(x.miles * 100) / 100,
    listedAddress: listedAddress(x.p),
    sameAddress: x.street,
  });
  const here = named.filter((x) => x.miles <= HERE_MILES);
  const openHere = here.find((x) => !x.p.closed);
  // Only a clear "another street" is "different"; no house number on either side is no evidence either way.
  if (openHere) return found(openHere.street === false ? "different" : "same", openHere);
  const openAround = named.filter((x) => !x.p.closed && x.miles > HERE_MILES);
  if (openAround.length > 0 && openAround.length <= CHAIN_LIMIT) return found("elsewhere", openAround[0]!);
  const closedHere = here.find((x) => x.p.closed);
  if (closedHere) return found("closed", closedHere);
  return none("none");
}

/** The word listings are looked up by: a name's first distinguishing word ("black" for "Black Rock - Pearland"). */
export function lookupWord(name: string | null | undefined): string | null {
  return businessWords(baseName(name))[0] ?? null;
}

/** Places grouped by their lookup word, for many accounts at once. */
export function indexByWord(places: readonly Place[]): Map<string, Place[]> {
  const m = new Map<string, Place[]>();
  for (const p of places) {
    const w = lookupWord(p.name);
    if (!w) continue;
    const list = m.get(w);
    if (list) list.push(p);
    else m.set(w, [p]);
  }
  return m;
}

export type WebCheckRow = {
  id: number;
  name: string;
  address: string | null;
  /** ZIP-area pin (approximate): our pin is the ZIP's center, so "here" means little. */
  approx: boolean;
  check: WebCheck;
};

/** The Web Check list's order: what needs a look first. */
export const WEB_STATUS_ORDER: readonly WebStatus[] = ["closed", "different", "elsewhere", "none", "nopin", "same"];

/** "Listed as permanently closed" → one line for the card, with the listing's details. */
export function webCheckLine(c: WebCheck): string {
  const label = WEB_STATUS_LABEL[c.status];
  if (!c.place) return label;
  const where = placeAddress(c.place);
  const far = c.status === "elsewhere" && c.miles != null ? ` (${c.miles < 10 ? c.miles.toFixed(1) : Math.round(c.miles)} mi from our pin)` : "";
  const pinOff = c.status === "elsewhere" && c.sameAddress ? ". Same address as ours: the map pin looks off" : "";
  return `${label}${where ? `: ${where}` : ""}${far}${pinOff}`;
}
