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

/** The key of one ticket's use of one part, as `PullContext.later` is keyed. */
export const useKey = (k: string, p: number): string => `${k}\u0000${p}`;

/** What a pull needs to know besides the uses: where merged records went, and what is waiting to show. */
export type PullContext = {
  /**
   * Where a record's uses count now, when it no longer has them: a ticket merged into another or into an install, a
   * PM billed on a ticket, an install merged into another.
   */
  moved?: (k: string) => string;
  /** The part a merged part went into. */
  mergedInto?: ReadonlyMap<number, number>;
  /** The parts the note counts (parts and water filters). */
  counts?: (p: number) => boolean;
  /**
   * The pieces a record will show for a part once what is waiting on it shows, keyed by `useKey`, for the records
   * that have something waiting: a PM's machine parts not billed on its ticket yet, where the ticket's own charge for
   * the part is counted instead; a merged ticket's charges on an install whose invoice isn't approved yet.
   */
  later?: ReadonlyMap<string, number>;
};

/**
 * What a new pull reports, against what the pulls before it reported (`earlier`).
 * - A use reported before is compared at its pieces now, whatever its day is now: a moved date is never a new use,
 *   and pieces added later are counted once.
 * - Where an earlier use's record no longer has it, `moved` says where it counts now, and it is compared there. One
 *   its record still has stays there, even when the record was merged.
 * - Fewer pieces than reported are taken off (a line cut or deleted, the wrong part fixed, the ticket cancelled, a
 *   duplicate's line deleted after a merge), except the pieces still waiting to show (`later`): those are held.
 * - A use not reported yet: its pieces, when its day is in `window` (the ledger's first Saturday through this pull's
 *   Friday). One dated later waits for its own week.
 * A part the note no longer counts is left as reported.
 */
export function pullChanges(now: CurrentUse[], earlier: LedgerUse[], window: { from: string; to: string }, ctx: PullContext = {}): LedgerUse[] {
  const moved = ctx.moved ?? ((k: string) => k);
  const counts = ctx.counts ?? (() => true);
  const current = new Map<string, CurrentUse>();
  for (const u of now) {
    const hit = current.get(useKey(u.k, u.p));
    if (hit) {
      hit.q += u.q;
      if ((u.day ?? "") > (hit.day ?? "")) hit.day = u.day;
    } else current.set(useKey(u.k, u.p), { ...u });
  }
  const reported = new Map<string, LedgerUse>();
  for (const u of earlier) {
    const p = ctx.mergedInto?.get(u.p) ?? u.p;
    const to = current.has(useKey(u.k, p)) ? u.k : moved(u.k);
    const at = useKey(to, p);
    const hit = reported.get(at) ?? { k: to, p, q: 0 };
    hit.q += u.q;
    reported.set(at, hit);
  }
  const out: LedgerUse[] = [];
  for (const [at, r] of reported) {
    if (!counts(r.p)) continue;
    const cur = current.get(at)?.q ?? 0;
    // Pieces taken off, except the ones that are only waiting to show.
    const q = round2(cur >= r.q ? cur - r.q : Math.min(0, Math.max(cur, ctx.later?.get(at) ?? cur) - r.q));
    if (q) out.push({ k: r.k, p: r.p, q });
  }
  for (const [at, c] of current) {
    if (reported.has(at) || !counts(c.p) || !c.day || c.day < window.from || c.day > window.to) continue;
    const q = round2(c.q);
    if (q) out.push({ k: c.k, p: c.p, q });
  }
  return out.sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : a.p - b.p));
}

/** A use as Parts → Usage counts it, with the rank of what it was read from: 1 a ticket's charges or an approved invoice. */
export type RankedUse = CurrentUse & { rank: number };

/**
 * What each record will show for a part once its waiting pieces show (pullChanges' `later`): the waiting pieces with
 * its charges or approved invoice lines now. Pieces read from anything else (QuickBooks, WO part lines, a PM's
 * machine parts) are replaced by them, as Parts → Usage counts a record's part from the first of those it has.
 */
export function laterPieces(uses: RankedUse[], waiting: ReadonlyMap<string, number>): Map<string, number> {
  const now = new Map(uses.map((u) => [useKey(u.k, u.p), u]));
  const out = new Map<string, number>();
  for (const [at, q] of waiting) {
    const u = now.get(at);
    out.set(at, round2((u?.rank === 1 ? u.q : 0) + q));
  }
  return out;
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
