/**
 * Part usage (Chuy, 10/28): how many tickets used each part on the Parts list, how many pieces, and when. One use is
 * one ticket and one part, whatever the number of lines. Where it comes from, and which record wins when a ticket was
 * written up twice, is in part-usage-api.ts. This file holds the plain pieces: periods, month / quarter / year
 * buckets, and the ranked report, so they can be checked without a database.
 */

/**
 * A use's ticket type. A QuickBooks history work order, or a Corrigo or NetSuite WO part line, that isn't on a KatzDesk
 * ticket has its source as its type.
 */
export const USAGE_TYPES = ["service", "tlc", "pm", "install", "rebuild", "deal", "quickbooks", "corrigo", "netsuite"] as const;
export type UsageType = (typeof USAGE_TYPES)[number];

export const USAGE_TYPE_LABEL: Record<UsageType, string> = {
  service: "Service",
  tlc: "TLC",
  pm: "PM",
  install: "Install",
  rebuild: "Rebuild",
  deal: "Pipeline",
  quickbooks: "QuickBooks",
  corrigo: "Corrigo",
  netsuite: "NetSuite",
};

/** Where a use was read from: KatzDesk itself, the QuickBooks history, or a WO part line from Corrigo or NetSuite. */
export const USAGE_SOURCES = ["desk", "quickbooks", "corrigo", "netsuite"] as const;
export type UsageSource = (typeof USAGE_SOURCES)[number];

export const USAGE_SOURCE_LABEL: Record<UsageSource, string> = { desk: "KatzDesk", quickbooks: "QuickBooks", corrigo: "Corrigo", netsuite: "NetSuite" };

export const USAGE_PERIODS = ["30d", "90d", "12m", "ytd", "last-year", "all"] as const;
export type UsagePeriod = (typeof USAGE_PERIODS)[number];

export const USAGE_PERIOD_LABEL: Record<UsagePeriod, string> = {
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  "12m": "Last 12 months",
  ytd: "This year",
  "last-year": "Last year",
  all: "All time",
};

export const USAGE_GROUPS = ["month", "quarter", "year"] as const;
export type UsageGroup = (typeof USAGE_GROUPS)[number];

export const USAGE_GROUP_LABEL: Record<UsageGroup, string> = { month: "By month", quarter: "By quarter", year: "By year" };

export const USAGE_SORTS = ["tickets", "pieces", "recent"] as const;
export type UsageSort = (typeof USAGE_SORTS)[number];

export const USAGE_SORT_LABEL: Record<UsageSort, string> = { tickets: "Most tickets", pieces: "Most pieces", recent: "Used most recently" };

/** One ticket's use of one part. `usedOn` is the day the work was done (YYYY-MM-DD), when known. */
export type PartUse = {
  partId: number;
  /** "service:12", "pm:4", "qb:88": one per ticket, so a ticket is counted once. */
  ticketKey: string;
  type: UsageType;
  /**
   * The ticket, PM, install, rebuild or deal it opens; for QuickBooks history, the history work order; for a WO part
   * line on no ticket, the line.
   */
  refId: number;
  /** The QuickBooks history work order, when the use came from one. */
  historyId: number | null;
  usedOn: string | null;
  customer: string | null;
  /** Call ID and WO, the PM's or install's WO, the rebuild's title, or the history or WO part line's WO. */
  label: string | null;
  pieces: number;
  source: UsageSource;
};

export type UsageTotals = { tickets: number; pieces: number; firstUsed: string | null; lastUsed: string | null };

const pad = (n: number) => String(n).padStart(2, "0");

function parts(iso: string): [number, number, number] {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return [y || 1970, m || 1, d || 1];
}

function shiftDays(iso: string, days: number): string {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The period's first and last day; All time has no bounds. "Last 12 months" is this month and the 11 before it. */
export function usageRange(period: UsagePeriod, today: string): { from: string | null; to: string | null } {
  const [y, m] = parts(today);
  switch (period) {
    case "30d":
      return { from: shiftDays(today, -29), to: today };
    case "90d":
      return { from: shiftDays(today, -89), to: today };
    case "12m": {
      const start = new Date(Date.UTC(y, m - 1 - 11, 1));
      return { from: start.toISOString().slice(0, 10), to: today };
    }
    case "ytd":
      return { from: `${y}-01-01`, to: today };
    case "last-year":
      return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
    default:
      return { from: null, to: null };
  }
}

/** "2026-10", "2026-Q4" or "2026". */
export function bucketKey(date: string, group: UsageGroup): string {
  const [y, m] = parts(date);
  if (group === "year") return String(y);
  if (group === "quarter") return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
  return `${y}-${pad(m)}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Oct 2026", "Q4 2026" or "2026". */
export function bucketLabel(key: string, group: UsageGroup): string {
  if (group === "year") return key;
  if (group === "quarter") {
    const [y, q] = key.split("-Q");
    return `Q${q} ${y}`;
  }
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
}

/** Every bucket from the one holding `from` to the one holding `to`, oldest first. */
export function bucketKeys(from: string, to: string, group: UsageGroup): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let [y, m] = parts(from);
  const end = bucketKey(to, group);
  const step = group === "year" ? 12 : group === "quarter" ? 3 : 1;
  if (group === "quarter") m = Math.floor((m - 1) / 3) * 3 + 1;
  if (group === "year") m = 1;
  for (let guard = 0; guard < 1200; guard++) {
    const key = bucketKey(`${y}-${pad(m)}-01`, group);
    out.push(key);
    if (key === end) break;
    m += step;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
  }
  return out;
}

/** Pieces as a person writes them: whole numbers bare, others to two places. */
export function piecesText(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? r.toLocaleString("en-US") : r.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

export function usageTotals(uses: Pick<PartUse, "usedOn" | "pieces">[]): UsageTotals {
  let first: string | null = null;
  let last: string | null = null;
  let pieces = 0;
  for (const u of uses) {
    pieces += u.pieces;
    if (u.usedOn) {
      if (!first || u.usedOn < first) first = u.usedOn;
      if (!last || u.usedOn > last) last = u.usedOn;
    }
  }
  return { tickets: uses.length, pieces: Math.round(pieces * 100) / 100, firstUsed: first, lastUsed: last };
}

export type UsageBucket = { key: string; label: string; tickets: number; pieces: number };

/**
 * Uses counted by month, quarter or year. With a range, every bucket in it shows, used or not; without one, the
 * buckets run from the first use to the last. A use with no date isn't in any bucket.
 */
export function usageBuckets(
  uses: Pick<PartUse, "usedOn" | "pieces" | "ticketKey">[],
  group: UsageGroup,
  range: { from: string | null; to: string | null },
): UsageBucket[] {
  const dated = uses.filter((u) => !!u.usedOn);
  const days = dated.map((u) => u.usedOn!).sort();
  const from = range.from ?? days[0];
  const to = range.to ?? days[days.length - 1];
  if (!from || !to) return [];
  const keys = bucketKeys(from, to, group);
  const at = new Map(keys.map((k, i) => [k, i]));
  const tickets = keys.map(() => new Set<string>());
  const pieces = keys.map(() => 0);
  for (const u of dated) {
    const i = at.get(bucketKey(u.usedOn!, group));
    if (i == null) continue;
    tickets[i]!.add(u.ticketKey);
    pieces[i] += u.pieces;
  }
  return keys.map((key, i) => ({ key, label: bucketLabel(key, group), tickets: tickets[i]!.size, pieces: Math.round(pieces[i]! * 100) / 100 }));
}

export type UsageReportRow = UsageTotals & {
  partId: number;
  /** Tickets in each of the report's buckets, in their order. */
  byBucket: number[];
  piecesByBucket: number[];
};

export type UsageReport = {
  buckets: UsageBucket[];
  rows: UsageReportRow[];
  /** Parts used, tickets that used at least one of them (a ticket with three parts is one), and pieces. */
  stats: { parts: number; tickets: number; pieces: number };
};

/** Every used part, ranked: most tickets first (or most pieces, or most recently used), then by part. */
export function usageReport(
  uses: PartUse[],
  group: UsageGroup,
  range: { from: string | null; to: string | null },
  sort: UsageSort = "tickets",
): UsageReport {
  const buckets = usageBuckets(uses, group, range);
  const at = new Map(buckets.map((b, i) => [b.key, i]));
  const byPart = new Map<number, PartUse[]>();
  for (const u of uses) {
    const list = byPart.get(u.partId);
    if (list) list.push(u);
    else byPart.set(u.partId, [u]);
  }
  const rows: UsageReportRow[] = [...byPart].map(([partId, list]) => {
    const byBucket = buckets.map(() => 0);
    const piecesByBucket = buckets.map(() => 0);
    for (const u of list) {
      if (!u.usedOn) continue;
      const i = at.get(bucketKey(u.usedOn, group));
      if (i == null) continue;
      byBucket[i] += 1;
      piecesByBucket[i] = Math.round((piecesByBucket[i]! + u.pieces) * 100) / 100;
    }
    return { partId, ...usageTotals(list), byBucket, piecesByBucket };
  });
  const recent = (a: UsageReportRow, b: UsageReportRow) => (b.lastUsed ?? "").localeCompare(a.lastUsed ?? "");
  rows.sort(
    (a, b) =>
      (sort === "pieces" ? b.pieces - a.pieces : sort === "recent" ? recent(a, b) : b.tickets - a.tickets) ||
      b.tickets - a.tickets ||
      b.pieces - a.pieces ||
      recent(a, b) ||
      a.partId - b.partId,
  );
  const tickets = new Set(uses.map((u) => u.ticketKey)).size;
  const pieces = Math.round(uses.reduce((s, u) => s + u.pieces, 0) * 100) / 100;
  return { buckets, rows, stats: { parts: rows.length, tickets, pieces } };
}

const SHORT_MONTH = (d: string) => {
  const [y, m, day] = parts(d);
  return `${MONTHS[m - 1]} ${day}, ${y}`;
};

/** "Oct 12, 2026". */
export function usageDay(iso: string | null): string {
  return iso ? SHORT_MONTH(iso) : "No date";
}

/** "14 tickets · 22 pcs". */
export function ticketsAndPieces(tickets: number, pieces: number): string {
  return `${tickets.toLocaleString("en-US")} ticket${tickets === 1 ? "" : "s"} · ${piecesText(pieces)} pc${pieces === 1 ? "" : "s"}`;
}

/** "Used on 14 tickets · 22 pcs · last Oct 12, 2026", or null when the part was never used. */
export function usageLine(t: UsageTotals | null | undefined): string | null {
  if (!t || !t.tickets) return null;
  const tickets = `${t.tickets.toLocaleString("en-US")} ticket${t.tickets === 1 ? "" : "s"}`;
  const pcs = `${piecesText(t.pieces)} pc${t.pieces === 1 ? "" : "s"}`;
  return [`Used on ${tickets}`, pcs, t.lastUsed ? `last ${usageDay(t.lastUsed)}` : null].filter(Boolean).join(" · ");
}
