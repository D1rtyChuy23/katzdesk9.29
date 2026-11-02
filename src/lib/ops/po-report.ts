/**
 * The weekly Purchase Order report for Teams (Chuy, 11/2): the parts and water filters used in a week, grouped by
 * manufacturer, with a count for each, to know what to reorder. It is pulled on Friday evening and read on Monday
 * morning. Each pull keeps what it reported, so the next one lists only what is new: a part entered late or
 * back-dated is on the next report, and a use already reported isn't reported again. Pure: no server imports, safe
 * for node --test.
 */

/** The report's week ends on a Friday and turns over at this hour, Chicago time (5 PM). */
export const PO_REPORT_HOUR = 17;

/** "2026-10-30" plus `days`. */
function shiftDay(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** The Chicago day and hour (0–23) of a moment. */
export function chicagoClock(at: Date = new Date()): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) % 24 };
}

/**
 * The week the report covers: Saturday through Friday, the latest one whose Friday 5 PM has come. From Friday 5 PM
 * until the next Friday 5 PM it is the same week, so Monday morning reads what Friday evening pulled.
 */
export function poReportWeek(date: string, hour: number): { from: string; to: string } {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y!, m! - 1, d!)).getUTCDay(); // 0 Sun … 5 Fri, 6 Sat
  const back = dow === 5 ? (hour >= PO_REPORT_HOUR ? 0 : 7) : (dow + 2) % 7;
  const to = shiftDay(date, -back);
  return { from: shiftDay(to, -6), to };
}

/** "Sat Oct 24". */
export function weekDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!))
    .toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })
    .replace(",", "");
}

/** "Fri Nov 6 at 5:30 PM", Chicago time. */
export function pulledLabel(iso: string): string {
  const at = new Date(iso);
  if (!Number.isFinite(at.getTime())) return "";
  const day = at.toLocaleDateString("en-US", { timeZone: "America/Chicago", weekday: "short", month: "short", day: "numeric" }).replace(",", "");
  const time = at.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" });
  return `${day} at ${time}`;
}

/** One ticket's use of one part (`k` the ticket, `p` the part), as a pull reports it: its pieces, or the change in them. */
export type LedgerUse = { k: string; p: number; q: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** A use as it stands now: its ticket, part and pieces, and its day (the ticket's completed, scheduled or received day). */
export type CurrentUse = LedgerUse & { day: string | null };

/**
 * What a new pull reports, against what the pulls before it reported (`earlier`).
 * - A use reported before: the change in its pieces, whatever its day is now, so a moved date is never a new use and
 *   pieces added or taken off later are counted once. One that is gone altogether is left as reported: it has moved
 *   to a record that doesn't count yet (a ticket merged into an install whose invoice isn't approved), or was
 *   cancelled or reclassed, and if it comes back it isn't new.
 * - A use not reported yet: its pieces, when its day is in `window` (the ledger's first Saturday through this pull's
 *   Friday). One dated later waits for its own week.
 * `moved` says where an earlier use's ticket counts now (a merged ticket, a PM billed on a ticket, a merged install);
 * `mergedInto`, the part a merged part went into.
 */
export function pullChanges(
  now: CurrentUse[],
  earlier: LedgerUse[],
  window: { from: string; to: string },
  moved: (k: string) => string = (k) => k,
  mergedInto: ReadonlyMap<number, number> = new Map(),
): LedgerUse[] {
  const key = (k: string, p: number) => `${k}\u0000${p}`;
  const reported = new Map<string, LedgerUse>();
  for (const u of earlier) {
    const k = moved(u.k);
    const p = mergedInto.get(u.p) ?? u.p;
    const hit = reported.get(key(k, p));
    if (hit) hit.q += u.q;
    else reported.set(key(k, p), { k, p, q: u.q });
  }
  const current = new Map<string, CurrentUse>();
  for (const u of now) {
    const hit = current.get(key(u.k, u.p));
    if (hit) {
      hit.q += u.q;
      if ((u.day ?? "") > (hit.day ?? "")) hit.day = u.day;
    } else current.set(key(u.k, u.p), { ...u });
  }
  const out: LedgerUse[] = [];
  for (const [at, r] of reported) {
    const c = current.get(at);
    if (!c) continue;
    const q = round2(c.q - r.q);
    if (q) out.push({ k: r.k, p: r.p, q });
  }
  for (const [at, c] of current) {
    if (reported.has(at) || !c.day || c.day < window.from || c.day > window.to) continue;
    const q = round2(c.q);
    if (q) out.push({ k: c.k, p: c.p, q });
  }
  return out.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.p - b.p));
}

/** Each part's pieces across a pull's changes. */
export function piecesByPart(changes: LedgerUse[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const u of changes) out.set(u.p, round2((out.get(u.p) ?? 0) + u.q));
  return out;
}

/**
 * Makers a part's description starts with, as the Parts list writes them (11/2: "Eversys O-RING …", "BUNN SWITCH …",
 * "de Jong Duke Mixer Motor …"). Each is read at the start of the description only, in any capitals.
 */
const DESCRIPTION_MAKERS: [string, RegExp][] = [
  ["La Marzocco", /^la\s+marzocco\b/i],
  ["La Spaziale", /^la\s+spaziale\b/i],
  ["Cimbali", /^(la\s+)?cimbali\b/i],
  ["Nuova Simonelli", /^nuova\s+simonelli\b/i],
  ["Victoria Arduino", /^victoria\s+arduino\b/i],
  ["de Jong Duke", /^de\s*jong\s+duke\b/i],
  ["Frosty Factory", /^frosty\s+factory\b/i],
  ["Curtis", /^(wilbur\s+)?curtis\b/i],
  ["Service Ideas", /^service\s+ideas\b/i],
  ["John Guest", /^john\s+guest\b/i],
  ["Eversys", /^eversys\b/i],
  ["Everpure", /^everpure\b/i],
  ["Faema", /^faema\b/i],
  ["Bunn", /^bunn\b/i],
  // "FetcoSingle …" is a Fetco part too.
  ["Fetco", /^fetco/i],
  ["Rancilio", /^rancilio\b/i],
  ["Ditting", /^ditting\b/i],
  ["Mazzer", /^mazzer\b/i],
  ["Casadio", /^casadio\b/i],
  ["Modbar", /^modbar\b/i],
  ["Bravilor", /^bravil(?:i)?or\b/i],
  ["Optipure", /^optipure\b/i],
  ["Synesso", /^synesso\b/i],
  ["Mahlkonig", /^mahlk(?:o|ö|oe)nig\b/i],
  ["BWT", /^bwt\b/i],
  ["Blendtec", /^blendtec\b/i],
  ["Airpot", /^airpot\b/i],
  ["Slayer", /^slayer\b/i],
  ["Cambro", /^cambro\b/i],
  ["Flojet", /^flojet\b/i],
  ["Oetiker", /^oetiker\b/i],
  ["Urnex", /^urnex\b/i],
  ["Schaerer", /^schaerer\b/i],
  ["Franke", /^franke\b/i],
  ["Thermoplan", /^thermoplan\b/i],
  ["Baratza", /^baratza\b/i],
  ["Astoria", /^astoria\b/i],
];

/** SKUs as the Parts list files them for one maker (11/2), for a part with no description. */
const SKU_MAKERS: [RegExp, string][] = [
  [/^EVERPURE/, "Everpure"],
  [/^WFEV/, "Everpure"],
  [/^EVER\d/, "Eversys"],
  [/^EVERSYS/, "Eversys"],
  [/^RAN\d/, "Rancilio"],
  [/^DIT\d/, "Ditting"],
  [/^BB\d/, "Bravilor"],
  [/^DJD/, "de Jong Duke"],
  [/^BWT/, "BWT"],
  [/^MAHL/, "Mahlkonig"],
  [/^FFF/, "Frosty Factory"],
  [/^CA\d/, "Casadio"],
  [/^LM/, "La Marzocco"],
  [/^FA\d/, "Faema"],
  [/^NS\d/, "Nuova Simonelli"],
  [/^BUNN/, "Bunn"],
  [/^FETCO/, "Fetco"],
];

export const OTHER_MAKER = "Other";

const squash = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** The NetSuite group of a part ("BUNN PARTS"), from its parent, else its item before the last colon. */
function netsuiteGroup(part: { parent?: string | null; item?: string | null }): string {
  const parent = String(part.parent ?? "").trim();
  if (parent) return parent;
  const item = String(part.item ?? "");
  const at = item.lastIndexOf(":");
  return at > 0 ? item.slice(0, at).trim() : "";
}

/**
 * The maker of a part. KatzDesk keeps no maker on a part (the Parts export's manufacturer column is blank), so it is
 * read from what the part has:
 *  1. the maker its description starts with ("Mazzer Doser …" is Mazzer, even when NetSuite files it under La
 *     Marzocco parts);
 *  2. a NetSuite group named for one maker ("BUNN PARTS", "FAEMAPARTS", "NUOVASIMONELLI");
 *  3. the maker its SKU is filed under ("EVER100242", "RAN10025015", "LM1207");
 *  4. else Other.
 * On the live list (11/2) this names a maker for 1,160 of the 1,195 parts and water filters ever used.
 */
export function partMaker(part: { description?: string | null; parent?: string | null; item?: string | null; sku?: string | null }): string {
  const description = String(part.description ?? "").trim();
  for (const [maker, re] of DESCRIPTION_MAKERS) if (re.test(description)) return maker;
  const group = squash(netsuiteGroup(part)).replace(/PARTS$/, "");
  if (group) {
    const hit = DESCRIPTION_MAKERS.find(([maker]) => squash(maker) === group);
    if (hit) return hit[0];
  }
  const sku = String(part.sku ?? "").toUpperCase().replace(/\s+/g, "");
  for (const [re, maker] of SKU_MAKERS) if (re.test(sku)) return maker;
  return OTHER_MAKER;
}

/**
 * The part's name under its maker's heading: its description without the maker in front ("O-RING Ø6.07X1.78").
 * Blank when the part has no description: its SKU is already on the line.
 */
export function partLabel(part: { description?: string | null }, maker: string): string {
  const description = String(part.description ?? "").replace(/\s+/g, " ").trim();
  const re = DESCRIPTION_MAKERS.find(([m]) => m === maker)?.[1];
  const hit = re ? re.exec(description) : null;
  const rest = hit ? description.slice(hit[0].length).replace(/^[\s,:;–-]+/, "").trim() : description;
  return rest || description;
}

/** The classes the report counts: parts and water filters, and parts with no class yet. Not equipment or service. */
export function countsForPo(part: { itemClass?: string | null; kind?: string | null }): boolean {
  const cls = String(part.itemClass ?? "").trim();
  if (cls) return cls === "Parts" || cls === "Water Filters";
  const kind = String(part.kind ?? "part");
  return kind === "part" || kind === "other";
}
