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
import { nameTokens, placeAddress, sameName, sameStreet, type Place } from "./places.ts";

export type WebStatus = "same" | "different" | "closed" | "elsewhere" | "none" | "nopin";

export type WebCheck = {
  status: WebStatus;
  /** The listing the status is about (the open one at our pin, the closed one, or the one elsewhere). */
  place: Place | null;
  /** Miles from our pin to that listing. */
  miles: number | null;
  /** The listing's address in our format ("502 Texas Ave, Houston, TX 77002"), when it has a street. */
  listedAddress: string | null;
};

/** Our pin and the listing this close (miles) are the same place: one block, to allow for where each map put it. */
export const HERE_MILES = 0.15;
/** How far to look for the same name when it is not at our pin. */
export const ELSEWHERE_MILES = 25;
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

/** A listing's address the way our accounts write them: "502 Texas Ave, Houston, TX 77002". Null without a street. */
export function listedAddress(p: Pick<Place, "street" | "city" | "zip">): string | null {
  if (!p.street) return null;
  const tail = [p.city, ["TX", p.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [p.street, tail].filter(Boolean).join(", ");
}

export type WebAccount = { name: string; lat: number | null; lng: number | null; address: string | null };

/**
 * The check for one account. `candidates` are the listings around it (any name; the server passes the ones sharing the
 * name's first word, within ELSEWHERE_MILES).
 */
export function webCheck(account: WebAccount, candidates: readonly Place[]): WebCheck {
  const none = (status: WebStatus): WebCheck => ({ status, place: null, miles: null, listedAddress: null });
  if (account.lat == null || account.lng == null) return none("nopin");
  const pin: LatLng = { lat: account.lat, lng: account.lng };
  const named = candidates
    .filter((p) => sameName(p.name, account.name))
    .map((p) => ({ p, miles: milesBetween(pin, p) }))
    .filter((x) => x.miles <= ELSEWHERE_MILES)
    .sort((a, b) => Number(a.p.closed) - Number(b.p.closed) || a.miles - b.miles);
  const found = (status: WebStatus, x: { p: Place; miles: number }): WebCheck => ({
    status,
    place: x.p,
    miles: Math.round(x.miles * 100) / 100,
    listedAddress: listedAddress(x.p),
  });
  const here = named.filter((x) => x.miles <= HERE_MILES);
  const openHere = here.find((x) => !x.p.closed);
  if (openHere) {
    // No street on either side: nothing to compare, so the listing stands as "same".
    const differs = !!openHere.p.street && !!account.address && !sameStreet(openHere.p.street, account.address);
    return found(differs ? "different" : "same", openHere);
  }
  // Away from our pin the listing's name may not add words to ours: "Black Rock Coffee Bar" is "Black Rock - Pearland"
  // ("coffee" and "bar" say what it is), but "Hugo's Cocina" is not "Hugo's".
  const ours = nameTokens(account.name).length;
  const openAround = named.filter((x) => !x.p.closed && x.miles > HERE_MILES && nameTokens(x.p.name).length <= ours);
  const distinct = openAround.length > 0 && openAround.length <= CHAIN_LIMIT;
  if (distinct) return found("elsewhere", openAround[0]!);
  const closedHere = here.find((x) => x.p.closed);
  if (closedHere) return found("closed", closedHere);
  return none("none");
}

/** The word listings are looked up by: a name's first distinguishing word ("black" for "Black Rock - Pearland"). */
export function lookupWord(name: string | null | undefined): string | null {
  return nameTokens(name)[0] ?? null;
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
  return `${label}${where ? `: ${where}` : ""}${far}`;
}
