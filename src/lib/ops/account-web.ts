/**
 * Web Check (Chuy, 11/27): is each customer's address still current? Each account is compared with the business
 * listings bundled for Prospects (Overture Maps places, src/lib/ops/places-tiles/, refreshed monthly), including the
 * ones Overture marks permanently closed:
 *
 * - same:      listed under our name at our pin, or at our street address within SAME_ADDRESS_MILES of the pin (a big
 *              site such as a hotel campus: the geocoder and the listing put the point on different buildings).
 * - different: listed under our name at our pin, at another street address (one of the two is out of date).
 * - closed:    listed under our name at our pin (or at our address), and marked permanently closed, with no open
 *              listing nearby.
 * - elsewhere: listed under our name away from our pin: at our own address farther off (the pin is off), or somewhere else within
 *              reach (10 miles of a street pin, 25 of a ZIP-area one), when it is the only open listing under our name
 *              within 25 miles and carries no chain brand: it may have moved, or our pin may be wrong.
 * - maybe:     no listing under our name, but one at our pin whose name starts the same and shares another word
 *              ("Elio's Pizzeria & Bar" and "Elio's Osteria e Pizzeria"): shown for a person to judge, never offered.
 * - none:      no listing under our name around. Not proof of anything: the listings cover the Prospects types
 *              (restaurants, cafés, hotels, offices...) in Texas only, and not every business is in them.
 * - nopin:     the account has no map pin, so there is nowhere to look (the Address Report's Open list is for those).
 *
 * Pure: safe for node --test and the screens.
 */
import { milesBetween, type LatLng } from "./geo.ts";
import { placeAddress, type Place } from "./places.ts";
import { normalizeAddress, tidyAddress } from "./address-report.ts";

export type WebStatus = "same" | "different" | "closed" | "elsewhere" | "maybe" | "none" | "nopin";

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
  /** Our house number and street, but another ZIP (sameAddress is then false): the two ZIPs. */
  zipOnly?: { theirs: string; ours: string } | null;
};

/** Our pin and the listing this close (miles) are the same place: one block, to allow for where each map put it. */
export const HERE_MILES = 0.15;
/** A listing at our very street address this close (miles) is at our address: one site, mapped on another building. */
export const SAME_ADDRESS_MILES = 0.5;
/** How far to look for the same name when it is not at our pin: a street pin is trusted more than a ZIP-area one. */
export const ELSEWHERE_MILES = 25;
export const ELSEWHERE_MILES_STREET_PIN = 10;
/** More open listings than this under one name within ELSEWHERE_MILES: a chain (or a business with branches), so another store says nothing about ours. */
export const CHAIN_LIMIT = 1;

export const WEB_STATUS_LABEL: Record<WebStatus, string> = {
  same: "Listed at this address",
  different: "Listed at another address",
  closed: "Listed as permanently closed",
  elsewhere: "Listed somewhere else",
  maybe: "Possible match",
  none: "No listing found",
  nopin: "No map pin",
};

/**
 * A listing's address the way our accounts write them, tidied the way the Address Report offers it: "502 Texas Ave,
 * Houston, TX 77002". Null unless the street starts with a house number: a listing without one is never offered.
 */
export function listedAddress(p: Pick<Place, "street" | "city" | "zip">): string | null {
  // A street that already carries a city or state after a comma, or a listing without a city or Texas ZIP, is not offered.
  if (!p.street || p.street.includes(",") || !p.city || !p.zip || !/^7[5-9]\d{3}$/.test(p.zip) || streetKey(p.street) == null) return null;
  return tidyAddress(`${titleCase(p.street)}, ${titleCase(p.city)}, TX ${p.zip}`);
}

/** "1432 W 13TH ST" → "1432 W 13th St"; a name already in mixed case stays as it is. */
function titleCase(s: string): string {
  if (s !== s.toUpperCase() && s !== s.toLowerCase()) return s;
  return s.toLowerCase().replace(/\b([a-z])/g, (_, c: string) => c.toUpperCase()).replace(/\b(Fm|Cr|Sh|Us|Ih|Nw|Ne|Sw|Se)\b/g, (m) => m.toUpperCase()).replace(/(\d)(St|Nd|Rd|Th)\b/g, (_, d: string, o: string) => d + o.toLowerCase());
}

// ---------------------------------------------------------------------------------------------------------------------
// Names: strict, because a match can lead an Admin to change an address

/** Words that say nothing about which business it is ("The", "LLC", "La", "de"). */
const NOISE = new Set(["the", "and", "of", "at", "a", "co", "company", "inc", "llc", "ltd", "corp", "la", "el", "los", "las", "le", "les", "de", "del", "di", "da", "y"]);
/** Words that say what kind of place it is, not which one: they must not decide a match on their own. */
const KIND = new Set(["cafe", "coffee", "shop", "house", "restaurant", "bar", "grill", "kitchen", "bakery", "hotel", "suites", "inn"]);

/** An account's name without the location we add after " - ", " @ ", " | " or "(": "Black Rock - Pearland" → "Black Rock". */
export function baseName(name: string | null | undefined): string {
  // A dash with a space on either side ("HTX- Kids Meals", "Rock -Pearland"; not "Bar-B-Que"), or a QuickBooks job
  // after a colon ("Brevity Coffee Company #15F:Job 1").
  return String(name ?? "").split(/\s+[-–—@|]\s*|\s*[-–—@|]\s+|\s*\(|\s*:/)[0]!.trim();
}

function nameWords(name: string | null | undefined): string[] {
  return String(name ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    // A store number says which store, not which business: "Boondocks Cafe #2" is "Boondocks Cafe".
    .replace(/#\s*\d+[a-z]?\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !NOISE.has(w));
}

/** Whether a possible match's street address is ours, in words for the card and the report row. */
export function maybeAddressNote(c: Pick<WebCheck, "sameAddress" | "zipOnly">): string {
  if (c.zipOnly) return zipNote(c.zipOnly);
  return c.sameAddress === true ? "Its street address is ours." : c.sameAddress === false ? "Its street address differs from ours too." : "";
}

function zipNote(z: { theirs: string; ours: string }): string {
  return `Its street is ours, but its ZIP is ${z.theirs} (ours ${z.ours}).`;
}

/**
 * The address an Admin may take from the listing (Use Listed Address), or null. At our pin a listing at another
 * address, or only another ZIP, is offered: it is the same place, and one of the two is out of date. Somewhere else,
 * only another street is: our street in another ZIP is most likely another town, so nothing is offered.
 */
export function offeredAddress(c: Pick<WebCheck, "status" | "sameAddress" | "zipOnly" | "listedAddress">): string | null {
  if (c.sameAddress !== false || !c.listedAddress) return null;
  if (c.status === "different") return c.listedAddress;
  if (c.status === "elsewhere" && !c.zipOnly) return c.listedAddress;
  return null;
}

/** The words that tell one business from another, in order; one-letter words count ("C & D Motors" is not "J O Motors"). */
export function businessWords(name: string | null | undefined): string[] {
  return nameWords(name).filter((w) => !KIND.has(w));
}

/** The kind words of a name, sorted ("Social Cafe" → ["coffee"]: a café and a coffee shop are one kind). */
export function kindWords(name: string | null | undefined): string[] {
  return [...new Set(nameWords(name).filter((w) => KIND.has(w)).map((w) => (w === "cafe" ? "coffee" : w)))].sort();
}

/**
 * The same business by name, after our location suffix: the distinguishing words are the same, in order, and the kind
 * words agree ("Social Cafe" is not "Social House"; "Black Rock Coffee Bar" is "Black Rock - Pearland", where our name
 * leaves the kind out, but only for a name of two words or more). A one-word name must be at least five letters, or
 * three with the same kind word ("Katz Coffee"). "La Bar" is not "La Sicilia"; "Hugo's Cocina" is not "Hugo's".
 */
export function sameBusiness(listingName: string | null | undefined, accountName: string | null | undefined): boolean {
  if (sameWords(baseName(listingName), baseName(accountName))) return true;
  // The listing may carry our location without a separator: "Tostada Regia Long Point" is "Tostada Regia - Long Point".
  return baseName(accountName) !== String(accountName ?? "").trim() && sameWords(listingName, accountName);
}

function sameWords(listingName: string | null | undefined, accountName: string | null | undefined): boolean {
  const ours = businessWords(accountName);
  const theirs = businessWords(listingName);
  if (!ours.length || ours.length !== theirs.length || !ours.every((w, i) => w === theirs[i])) return false;
  const ka = kindWords(accountName).join(" ");
  const kb = kindWords(listingName).join(" ");
  if (ours.length >= 2) return ka === kb || !ka || !kb;
  return ka === kb && (ours[0]!.length >= 5 || (!!ka && ours[0]!.length >= 3));
}

// ---------------------------------------------------------------------------------------------------------------------
// Streets

const ROUTE: Record<string, string> = { fm: "fm", farm: "fm", interstate: "i", i: "i", ih: "i", hwy: "hwy", sh: "hwy", us: "hwy", tx: "hwy", cr: "cr", county: "cr" };
const DIRECTIONS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);
/** Street types, as normalizeAddress writes them: "1 A St" is A Street, "502 A Texas Ave" is unit A. */
const STREET_TYPE = new Set(["st", "ave", "rd", "dr", "blvd", "ln", "ct", "pl", "way", "pkwy", "cir", "trl", "loop", "fwy", "hwy"]);
const ORDINAL: Record<string, string> = { first: "1st", second: "2nd", third: "3rd", fourth: "4th", fifth: "5th", sixth: "6th", seventh: "7th", eighth: "8th", ninth: "9th", tenth: "10th" };

/**
 * House number and street, for comparing two addresses: "502 Texas Ave" and "502 N Texas Avenue, Houston" are both
 * "502 texas"; "1234 Farm to Market 1960" and "1234 FM 1960 Rd" are "1234 fm 1960"; "1901 Avenue Q" is "1901 ave q".
 * Null when the address does not start with a house number ("Southwest Fwy", "One University Way", "The Galleria,
 * 5015 Westheimer Rd").
 */
export function streetKey(address: string | null | undefined): string | null {
  // "FM2673" and "IH10": a route and its number run together are two words.
  const words = normalizeAddress(String(address ?? "").split(",")[0])
    .split(" ")
    .filter(Boolean)
    .flatMap((w) => w.match(/^(fm|cr|sh|us|ih|hwy)(\d+)$/)?.slice(1) ?? [w]);
  const num = words[0]?.match(/^(\d+)[a-z]?$/)?.[1];
  if (!num) return null;
  let i = 1;
  // "8 1/2 Main St": the half is part of the number.
  if (words[i] === "1" && words[i + 1] === "2") i += 2;
  // "502-A Texas" and "215-294 Main" (a range) normalize to "502 a texas" and "215 294 main": the second part is not
  // the street, unless a street type follows it ("1 A St", "100 E St").
  else if (words[i] && /^(\d+|[a-z])$/.test(words[i]!) && words[i + 1] && !ROUTE[words[i]!] && !STREET_TYPE.has(words[i + 1]!)) i++;
  while (words[i] && DIRECTIONS.has(words[i]!) && words[i + 1] && !STREET_TYPE.has(words[i + 1]!)) i++;
  let w = words[i];
  if (!w) return null;
  w = ORDINAL[w] ?? w;
  // "State Highway 6" and "State St": a route only when a highway word or number follows.
  const route = w === "state" ? (words[i + 1] === "hwy" || /^\d/.test(words[i + 1] ?? "") ? "hwy" : undefined) : ROUTE[w];
  if (route) {
    // "farm to market 1960", "state highway 6", "county road 12": the route number is what tells it apart.
    let j = i + 1;
    while (words[j] && !/^\d/.test(words[j]!) && j < i + 4) j++;
    return words[j] ? `${num} ${route} ${words[j]}` : `${num} ${route}`;
  }
  // "Avenue Q", "Loop 410": the word after the street type is the name.
  if ((w === "ave" || w === "loop") && words[i + 1] && !STREET_TYPE.has(words[i + 1]!) && !DIRECTIONS.has(words[i + 1]!)) return `${num} ${w} ${words[i + 1]}`;
  return `${num} ${w}`;
}

/** The ZIP an address ends with, if any. */
function zipOf(address: string | null | undefined): string | null {
  return String(address ?? "").match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? null;
}

/**
 * Whether two addresses are the same street address (house number and street, and the ZIP when both give one); null
 * when either has no house number to compare.
 */
/** Our house number and street with another ZIP: the two ZIPs; null otherwise (or when either has no ZIP). */
export function zipOnlyDifference(
  listingStreet: string | null | undefined,
  listingZip: string | null | undefined,
  ourAddress: string | null | undefined,
): { theirs: string; ours: string } | null {
  const x = streetKey(listingStreet);
  const y = streetKey(ourAddress);
  const theirs = listingZip ?? zipOf(listingStreet);
  const ours = zipOf(ourAddress);
  return x != null && x === y && theirs && ours && theirs !== ours ? { theirs, ours } : null;
}

export function sameStreetAddress(a: string | null | undefined, b: string | null | undefined, zipA?: string | null, zipB?: string | null): boolean | null {
  const x = streetKey(a);
  const y = streetKey(b);
  if (x == null || y == null) return null;
  const za = zipA ?? zipOf(a);
  const zb = zipB ?? zipOf(b);
  return x === y && (!za || !zb || za === zb);
}

/**
 * A listing that may be ours though its name differs: the same first distinguishing word, and every word of the
 * shorter name in the longer one ("Elio's Pizzeria" in "Elio's Osteria e Pizzeria"; "Hampton Inn Port Lavaca" in
 * "Hampton Inn & Suites by Hilton Port Lavaca"). A one-word name needs five letters, and the other name may add only
 * one word to it ("Popeyes" and "Popeyes Louisiana Kitchen"; not "Velocity #5" and "Velocity Sim Racing Lounge", nor
 * "Cherry" and "Cherry Block Smokehouse"). "Port Lavaca Dodge" is not "Port Lavaca Ford"; "Texas Roadhouse" is not
 * "Texas Children's Hospital".
 */
export function possibleMatch(listingName: string | null | undefined, accountName: string | null | undefined): boolean {
  const ours = businessWords(baseName(accountName));
  const theirs = businessWords(baseName(listingName));
  if (!ours.length || !theirs.length || ours[0] !== theirs[0] || ours[0]!.length < 4) return false;
  const [short, long] = ours.length <= theirs.length ? [ours, theirs] : [theirs, ours];
  if (short.length === 1 && (short[0]!.length < 5 || long.length > 2)) return false;
  const words = new Set(long);
  return short.every((w) => words.has(w));
}

export type WebAccount = { name: string; lat: number | null; lng: number | null; address: string | null; approx?: boolean };

type Named = { p: Place; miles: number; street: boolean | null };

/**
 * The check for one account. `candidates` are the listings around it (any name; the server passes the ones sharing the
 * name's first word within ELSEWHERE_MILES).
 */
export function webCheck(account: WebAccount, candidates: readonly Place[]): WebCheck {
  const none = (status: WebStatus): WebCheck => ({ status, place: null, miles: null, listedAddress: null, sameAddress: null, zipOnly: null });
  if (account.lat == null || account.lng == null) return none("nopin");
  const pin: LatLng = { lat: account.lat, lng: account.lng };
  const reach = account.approx ? ELSEWHERE_MILES : ELSEWHERE_MILES_STREET_PIN;
  const all: Named[] = candidates
    .filter((p) => sameBusiness(p.name, account.name))
    .map((p) => ({ p, miles: milesBetween(pin, p), street: account.address && p.street ? sameStreetAddress(p.street, account.address, p.zip, null) : null }))
    .filter((x) => x.miles <= ELSEWHERE_MILES)
    .sort((a, b) => a.miles - b.miles);
  const named = all.filter((x) => x.miles <= reach);
  const found = (status: WebStatus, x: Named): WebCheck => ({
    status,
    place: x.p,
    miles: Math.round(x.miles * 100) / 100,
    listedAddress: listedAddress(x.p),
    sameAddress: x.street,
    zipOnly: x.street === false && account.address ? zipOnlyDifference(x.p.street, x.p.zip, account.address) : null,
  });
  // A listing at our very address is ours, whatever else is near: on our site, or farther off (then the pin is off).
  const ourStreet = named.find((x) => !x.p.closed && x.street === true);
  if (ourStreet) return found(ourStreet.miles <= SAME_ADDRESS_MILES ? "same" : "elsewhere", ourStreet);
  const here = named.filter((x) => x.miles <= HERE_MILES);
  const openHere = here.find((x) => !x.p.closed);
  // Only a clear "another street" is "different"; no house number on either side is no evidence either way.
  if (openHere) return found(openHere.street === false ? "different" : "same", openHere);
  // A chain (more than CHAIN_LIMIT open stores within ELSEWHERE_MILES, or a brand): its other stores say nothing of ours.
  const openAll = all.filter((x) => !x.p.closed);
  const chain = openAll.length > CHAIN_LIMIT || all.some((x) => !!x.p.brand);
  const openAround = named.filter((x) => !x.p.closed);
  if (!chain && openAround.length > 0) return found("elsewhere", openAround[0]!);
  const closedHere = here.find((x) => x.p.closed) ?? named.find((x) => x.p.closed && x.street === true);
  if (closedHere) return found("closed", closedHere);
  // Nothing under our name: a listing at our street pin whose name is close, for a person to judge. Never offered.
  if (!account.approx) {
    const maybe = candidates
      .filter((p) => !sameBusiness(p.name, account.name) && possibleMatch(p.name, account.name))
      .map((p) => ({ p, miles: milesBetween(pin, p) }))
      .filter((x) => x.miles <= HERE_MILES)
      .sort((a, b) => Number(a.p.closed) - Number(b.p.closed) || a.miles - b.miles)[0];
    if (maybe) {
      const street = account.address && maybe.p.street ? sameStreetAddress(maybe.p.street, account.address, maybe.p.zip, null) : null;
      const zipOnly = street === false ? zipOnlyDifference(maybe.p.street, maybe.p.zip, account.address) : null;
      return { status: "maybe", place: maybe.p, miles: Math.round(maybe.miles * 100) / 100, listedAddress: null, sameAddress: street, zipOnly };
    }
  }
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
export const WEB_STATUS_ORDER: readonly WebStatus[] = ["closed", "different", "elsewhere", "maybe", "none", "nopin", "same"];

/** "Listed as permanently closed" → one line for the card, with the listing's details. */
/** How far the listing's point is from ours, for a listing at our address: "under 50 ft", "300 ft", "0.4 mi". */
function pinGap(miles: number): string {
  const ft = Math.round((miles * 5280) / 50) * 50;
  return ft < 50 ? "under 50 ft" : ft < 1000 ? `${ft} ft` : `${miles.toFixed(1)} mi`;
}

/** "250 ft from our pin" for a listing at this address or listed somewhere else; null otherwise. Cards and report rows. */
export function pinDistance(c: Pick<WebCheck, "status" | "miles">): string | null {
  if (c.miles == null) return null;
  if (c.status === "elsewhere") return `${c.miles < 10 ? c.miles.toFixed(1) : Math.round(c.miles)} mi from our pin`;
  if (c.status === "same" || c.status === "maybe") return `${pinGap(c.miles)} from our pin`;
  return null;
}

export function webCheckLine(c: WebCheck): string {
  const label = WEB_STATUS_LABEL[c.status];
  if (!c.place) return label;
  const where = placeAddress(c.place);
  const gap = pinDistance(c);
  const far = gap ? ` (${gap})` : "";
  const pinOff =
    c.status === "elsewhere" && c.sameAddress
      ? ". Same address as ours: the map pin looks off"
      : c.status === "maybe"
        ? `. The name differs from ours: check it is the same business.${maybeAddressNote(c) ? ` ${maybeAddressNote(c)}` : ""}`
        : (c.status === "elsewhere" || c.status === "different") && c.zipOnly
          ? `. ${zipNote(c.zipOnly)}`
          : "";
  // A possible match names the listing: its name is the thing to check.
  const what = c.status === "maybe" ? [c.place.name, where].filter(Boolean).join(" · ") : where;
  return `${label}${what ? `: ${what}` : ""}${far}${pinOff}`;
}
