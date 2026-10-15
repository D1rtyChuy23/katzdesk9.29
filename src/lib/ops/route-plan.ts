/**
 * Planner routes: one day's open work per tech, in a suggested stop order, grouped by area, with Google Maps links.
 * Pure: no I/O, no DOM — safe for node --test. Distances are straight-line miles; nothing here knows drive times.
 */
import type { Install, PmJob, ServiceJob } from "./types.ts";
import { isOpenCall, isOpenPm } from "./ticket-status.ts";
import { isOpenInstall } from "./install-status.ts";
import { canonicalTechName } from "./tech-match.ts";
import { cleanTime, timeLabel, type BoardType } from "./day-board.ts";
import {
  canDriveTo,
  groupByArea,
  isPoint,
  milesBetween,
  milesLabel,
  orderStops,
  routeUrls,
  NO_REP_COLOR,
  REP_PALETTE,
  type LatLng,
  type PinQuality,
} from "./geo.ts";

export type StopType = BoardType;

/** Tech key for work with no tech yet. */
export const NO_TECH = "";
/** Outside contractor: a pseudo-tech that gets a list, not a route. */
export const THIRD_PARTY = "3rd Party";

/** Same words as the day board. */
export const STOP_LABEL: Record<StopType, string> = { service: "Ticket", tlc: "TLC", pm: "PM", install: "Install" };
export const STOP_TYPES: StopType[] = ["service", "tlc", "pm", "install"];

export const ANY_TIME = "Any time";

/** Tech name as lists group by it: the roster spelling when known, else the typed name, "" for no tech (day board rule). */
export function techKey(name: string | null | undefined): string {
  return name && name.trim() ? canonicalTechName(name) ?? name.trim() : NO_TECH;
}

// ---------------------------------------------------------------------------------------------------------------
// The day's stops

export type DayStop = {
  /** Unique per list row: `${type}-${id}`, plus "-2nd" for the secondary tech's copy. */
  key: string;
  type: StopType;
  id: number;
  /** Customer as shown ("Untitled" when blank). */
  customer: string;
  /** Customer as stored, for finding the account ("" when blank). */
  lookupName: string;
  ticket: string | null;
  /** "HH:MM" or null (most work has no time). */
  time: string | null;
  /** Tech key; NO_TECH when nobody is assigned. */
  tech: string;
  /** The other tech on a two-tech ticket; "" when there is none. */
  partner: string;
  /** This row is the copy on the secondary tech's list. */
  second: boolean;
};

type TicketIn = Pick<ServiceJob, "id" | "customer" | "scheduled" | "scheduledTime" | "technician" | "secondaryTech" | "status" | "done" | "duplicateOf" | "wo" | "callId">;
type PmIn = Pick<PmJob, "id" | "customer" | "projected" | "scheduledTime" | "technician" | "status" | "done" | "wo">;
type InstallIn = Pick<Install, "id" | "customer" | "installDate" | "scheduledTime" | "technician" | "complete" | "equipStatus" | "wo">;

/** Same job, either tech's copy. */
export const jobKey = (s: Pick<DayStop, "type" | "id">) => `${s.type}-${s.id}`;

const byTimeThenName = (a: DayStop, b: DayStop) =>
  (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.customer.localeCompare(b.customer) || a.key.localeCompare(b.key);

/**
 * The day's open work: tickets and TLCs scheduled that day (open, not a merged duplicate), PMs projected that day
 * (open), installs dated that day (not installed). A ticket's secondary tech also gets the stop, marked `second`.
 * Sorted by time (untimed last), then customer.
 */
export function collectDayStops(
  input: { installs: readonly InstallIn[]; pms: readonly PmIn[]; services: readonly TicketIn[]; tlcs: readonly TicketIn[] },
  day: string,
): DayStop[] {
  const out: DayStop[] = [];
  const add = (type: StopType, row: { id: number; customer: string | null; time: string | null; tech: string | null; ticket: string | null }, second?: string | null) => {
    const lookupName = String(row.customer ?? "").trim();
    const base: DayStop = {
      key: `${type}-${row.id}`,
      type,
      id: row.id,
      customer: lookupName || "Untitled",
      lookupName,
      ticket: row.ticket,
      time: cleanTime(row.time),
      tech: techKey(row.tech),
      partner: "",
      second: false,
    };
    const other = techKey(second);
    if (other !== NO_TECH && other !== base.tech) {
      out.push({ ...base, partner: other });
      out.push({ ...base, key: `${base.key}-2nd`, tech: other, partner: base.tech, second: true });
    } else {
      out.push(base);
    }
  };
  const ticket = (j: TicketIn, type: "service" | "tlc") => {
    if (j.scheduled !== day || j.duplicateOf || !isOpenCall(j)) return;
    add(type, { id: j.id, customer: j.customer, time: j.scheduledTime, tech: j.technician, ticket: j.wo || j.callId || null }, j.secondaryTech);
  };
  for (const j of input.services) ticket(j, "service");
  for (const j of input.tlcs) ticket(j, "tlc");
  for (const p of input.pms) {
    if (p.projected !== day || !isOpenPm(p)) continue;
    add("pm", { id: p.id, customer: p.customer, time: p.scheduledTime, tech: p.technician, ticket: p.wo });
  }
  for (const i of input.installs) {
    if (i.installDate !== day || !isOpenInstall(i)) continue;
    add("install", { id: i.id, customer: i.customer, time: i.scheduledTime, tech: i.technician, ticket: i.wo });
  }
  return out.sort(byTimeThenName);
}

// ---------------------------------------------------------------------------------------------------------------
// Where each stop is

/** What a stop needs from its account (an AccountGeo fits). */
export type StopPlace = {
  id: number;
  lat: number | null;
  lng: number | null;
  quality: PinQuality | null;
  address: string | null;
  city: string | null;
};

export type MissingReason = "no-account" | "no-pin" | "zip-area";

export const MISSING_LABEL: Record<MissingReason, string> = {
  "no-account": "No account matches this customer name",
  "no-pin": "No map pin for this account",
  "zip-area": "ZIP area only: no pin for the street address",
};

export type PlacedStop = DayStop & {
  accountId: number | null;
  /** The account's street-address pin; null when there is none (no pin, or only the ZIP area's center). */
  point: LatLng | null;
  /** How good the account's pin is (also set for a ZIP-area pin that is not used); null when there is no pin. */
  quality: PinQuality | null;
  /** The account's typed address. */
  address: string | null;
  city: string | null;
  /** Why the stop is not on the map; null when it has a street-address pin. */
  missing: MissingReason | null;
};

/**
 * Attach each stop's account pin. `find` gets the stored customer name (jobs link to accounts by name only).
 * Only a street match (exact or close) is a stop location. A ZIP-area pin is the middle of a ZIP code: it never goes
 * into the stop order, onto the route line, onto the map or into a Google Maps link, so that stop is listed as not on
 * the map ("zip-area"), like a stop with no pin at all.
 */
export function placeStops(stops: readonly DayStop[], find: (customer: string) => StopPlace | null | undefined): PlacedStop[] {
  return stops.map((s) => {
    const a = s.lookupName ? find(s.lookupName) ?? null : null;
    const p = a ? { lat: a.lat, lng: a.lng } : null;
    const pinned = isPoint(p);
    const street = pinned && canDriveTo(a?.quality);
    return {
      ...s,
      accountId: a ? a.id : null,
      point: street ? { lat: p.lat, lng: p.lng } : null,
      quality: pinned ? a?.quality ?? null : null,
      address: a?.address?.trim() || null,
      city: a?.city ?? null,
      missing: !a ? "no-account" : street ? null : pinned ? "zip-area" : "no-pin",
    };
  });
}

/** What goes into the Google Maps link: the street-address pin, or nothing (a ZIP-area pin or a typed address never does). */
export function linkStop(s: Pick<PlacedStop, "point" | "quality">): LatLng | null {
  return isPoint(s.point) && canDriveTo(s.quality) ? s.point : null;
}

const sameStop = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lng - b.lng) < 1e-7;

/** Where a tech's day can start. Without one, Google Maps starts from the phone's current location. */
export type RouteStart = { key: string; label: string; point: LatLng };

/** The Katz shop (Katz Coffee Service Dept., 2400 Karbach St, Houston, TX 77092; exact Census match). */
export const KATZ_SHOP: RouteStart = { key: "shop", label: "The Shop (2400 Karbach St)", point: { lat: 29.808821, lng: -95.46121 } };

/** Google Maps links for stops in this order. Two jobs in a row at the same place count as one stop. */
export function routeLinks(stops: readonly Pick<PlacedStop, "point" | "quality">[], start?: RouteStart | null): string[] {
  const list: LatLng[] = [];
  for (const s of stops) {
    const r = linkStop(s);
    if (r && !(list.length && sameStop(list[list.length - 1]!, r))) list.push(r);
  }
  return routeUrls(list, start?.point ?? null);
}

// ---------------------------------------------------------------------------------------------------------------
// By tech

export type RouteRow = PlacedStop & {
  point: LatLng;
  /** Stop number in the suggested order (1-based). */
  n: number;
  /** Straight-line miles from the previous stop; null for the first stop and for lists that are not routed. */
  legMiles: number | null;
};

export type TechRoute = {
  tech: string;
  label: string;
  /** False for "3rd Party" (an outside contractor) and for work with no tech yet: those stops are listed, not routed. */
  routed: boolean;
  /** Stops with a street-address pin: suggested order when routed, time order otherwise. */
  stops: RouteRow[];
  /** Stops with no street-address pin ("Not on the map": no account, no pin, or only a ZIP-area pin), time order. */
  unrouted: PlacedStop[];
  /** Straight-line miles along the suggested order (0 when not routed). */
  miles: number;
  /** Google Maps links (more than one when the day is longer than one link allows); empty when not routed. */
  links: string[];
};

export const techLabel = (tech: string) => tech || "Unassigned";

/** Should this tech's day get a route? Not for the outside contractor, not for work nobody is assigned to. */
export const routable = (tech: string) => tech !== NO_TECH && tech !== THIRD_PARTY;

/** Tech order for cards and colors: roster order, then anyone else by name. Unassigned is not included. */
export function techOrder(roster: readonly string[], techs: readonly string[]): string[] {
  const names = [...new Set(roster.map(techKey).filter((t) => t !== NO_TECH))];
  const known = new Set(names);
  const extra = [...new Set(techs.filter((t) => t !== NO_TECH && !known.has(t)))].sort((a, b) => a.localeCompare(b));
  return [...names, ...extra];
}

/**
 * One list per tech with work that day: roster order, then others by name, "Unassigned" last. Each routed list is in
 * the suggested order (timed stops keep their time order, untimed ones slot in where they add the fewest miles).
 */
export function planTechRoutes(stops: readonly PlacedStop[], roster: readonly string[] = [], start: RouteStart | null = null): TechRoute[] {
  const groups = new Map<string, PlacedStop[]>();
  for (const s of stops) groups.set(s.tech, [...(groups.get(s.tech) ?? []), s]);
  const order = [...techOrder(roster, [...groups.keys()]).filter((t) => groups.has(t)), ...(groups.has(NO_TECH) ? [NO_TECH] : [])];
  return order.map((tech) => {
    const list = [...groups.get(tech)!].sort(byTimeThenName);
    const label = techLabel(tech);
    if (!routable(tech)) {
      const pinned = list.filter((s) => isPoint(s.point)) as (PlacedStop & { point: LatLng })[];
      return {
        tech,
        label,
        routed: false,
        stops: pinned.map((s, i) => ({ ...s, n: i + 1, legMiles: null })),
        unrouted: list.filter((s) => !isPoint(s.point)),
        miles: 0,
        links: [],
      };
    }
    const plan = orderStops(list.map((s) => ({ item: s, point: s.point, time: s.time })), start?.point ?? null);
    const rows: RouteRow[] = plan.ordered.map((o, i) => ({
      ...o.item,
      point: o.point as LatLng,
      n: i + 1,
      legMiles: i > 0 ? milesBetween(plan.ordered[i - 1]!.point as LatLng, o.point as LatLng) : start ? milesBetween(start.point, o.point as LatLng) : null,
    }));
    return { tech, label, routed: true, stops: rows, unrouted: plan.unrouted.map((u) => u.item), miles: plan.miles, links: routeLinks(rows, start) };
  });
}

/** Stable color per tech from the fixed palette (by roster position, then others by name); no tech is gray. */
export function techColors(roster: readonly string[], techs: readonly string[] = []): Map<string, string> {
  return new Map(techOrder(roster, techs).map((t, i) => [t, REP_PALETTE[i % REP_PALETTE.length]!]));
}

export function colorOfTech(colors: ReadonlyMap<string, string>, tech: string): string {
  return tech === NO_TECH ? NO_REP_COLOR : colors.get(tech) ?? NO_REP_COLOR;
}

// ---------------------------------------------------------------------------------------------------------------
// By area

export type AreaGroup = {
  key: string;
  label: string;
  center: LatLng;
  stops: PlacedStop[];
  /** Techs with work in this area (primary and secondary), roster-independent name order. */
  techs: string[];
  /** Stops in this area with no tech yet. */
  unassigned: number;
};

/** "Ryan Gloria", "Ryan Gloria + Charles Foster", "Unassigned". */
export const crewLabel = (s: Pick<DayStop, "tech" | "partner">) => `${techLabel(s.tech)}${s.partner ? ` + ${s.partner}` : ""}`;

/**
 * Every job of the day (one row per job, so a two-tech ticket shows once with both names) grouped by pins within
 * `radiusMiles` of each other, named by city. Biggest area first. Stops with no street-address pin come back in `unplaced`.
 */
export function planAreas(stops: readonly PlacedStop[], radiusMiles = 5): { areas: AreaGroup[]; unplaced: PlacedStop[] } {
  const jobs = stops.filter((s) => !s.second);
  const { areas, unplaced } = groupByArea(jobs, (s) => s.point, (s) => s.city, { radiusMiles, tieKey: (s) => s.key });
  const rowOrder = (a: PlacedStop, b: PlacedStop) =>
    Number(a.tech === NO_TECH) - Number(b.tech === NO_TECH) || a.tech.localeCompare(b.tech) || byTimeThenName(a, b);
  const out = areas.map((a) => {
    const list = [...a.items].sort(rowOrder);
    const techs = [...new Set(list.flatMap((s) => [s.tech, s.partner]).filter((t) => t !== NO_TECH))].sort((x, y) => x.localeCompare(y));
    return { key: a.key, label: a.label, center: a.center, stops: list, techs, unassigned: list.filter((s) => s.tech === NO_TECH).length };
  });
  out.sort((a, b) => b.stops.length - a.stops.length || a.label.localeCompare(b.label));
  return { areas: out, unplaced: [...unplaced].sort(rowOrder) };
}

// ---------------------------------------------------------------------------------------------------------------
// Labels

/** "9a", "1:30p", or "Any time". */
export const stopTime = (time: string | null | undefined) => timeLabel(time) || ANY_TIME;

export const stopCount = (n: number) => `${n} ${n === 1 ? "stop" : "stops"}`;

/** "about 23 mi straight-line". */
export const milesNote = (miles: number) => `about ${milesLabel(miles)} straight-line`;

/** Count of jobs per type (each two-tech ticket once). */
export function typeCounts(stops: readonly DayStop[]): Record<StopType, number> {
  const out: Record<StopType, number> = { service: 0, tlc: 0, pm: 0, install: 0 };
  for (const s of stops) if (!s.second) out[s.type] += 1;
  return out;
}
