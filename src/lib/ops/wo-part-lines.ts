/**
 * WO part lines (Grok's request through Chuy, 10/28): the parts a work order used, as Corrigo or NetSuite lists them,
 * from a CSV, so Parts usage counts the tickets since the QuickBooks history ended (Aug 21, 2026). The import only adds
 * `ticket_part_lines` rows: Charges, invoices and Pull aren't touched, and nothing goes to Corrigo or NetSuite. This
 * file is the plain part: reading the file, finding a WO's ticket, and the plan. wo-part-lines-api.ts reads and writes
 * the database; part-usage-api.ts counts the lines.
 */
import { parseCompletedDate, woCanonical, woMatchKey } from "./corrigo.ts";

export const WO_LINES_MAX_ROWS = 5000;

export const LINE_SOURCES = ["corrigo", "netsuite"] as const;
export type LineSource = (typeof LINE_SOURCES)[number];
export const LINE_SOURCE_LABEL: Record<LineSource, string> = { corrigo: "Corrigo", netsuite: "NetSuite" };

/**
 * The SKU a line names: its item after the last colon, in capitals with no spaces. Corrigo's "BUNN PARTS:BUNN40670.0005"
 * and KatzDesk's "BUNN PARTS : BUNN40670.0005" are both BUNN40670.0005. part-usage-api.ts keys the parts the same way.
 */
export function lineSku(item: string | null | undefined): string {
  const t = String(item ?? "");
  return t
    .slice(t.lastIndexOf(":") + 1)
    .replace(/\s+/g, "")
    .toUpperCase();
}

/** corrigo or netsuite, however it is written ("Corrigo", "NetSuite", "Net Suite"); otherwise null. */
export function readSource(raw: string | null | undefined): LineSource | null {
  const k = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return k === "corrigo" ? "corrigo" : k === "netsuite" ? "netsuite" : null;
}

/** The qty: blank counts as 1, flagged; "2", "1.5", "-1", "1,000". Undefined when it can't be read. */
export function readQty(raw: string | null | undefined): { qty: number; blank: boolean } | undefined {
  const t = String(raw ?? "")
    .trim()
    .replace(/,/g, "");
  if (!t) return { qty: 1, blank: true };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return undefined;
  return { qty: Number(t), blank: false };
}

/**
 * The day a line was used: 2026-09-15, 9/15/2026, 9/15/26, "Sep 15, 2026" or an Excel day number. Null when blank,
 * undefined when it can't be read (or isn't a real day).
 */
export function readUsedOn(raw: string | null | undefined): string | null | undefined {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const d = parseCompletedDate(t);
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return undefined;
  const at = new Date(`${d}T00:00:00Z`);
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== d) return undefined;
  return d >= "2000-01-01" && d <= "2100-12-31" ? d : undefined;
}

export type WoLineRow = {
  /** Line in the file, counting the header as 1. */
  line: number;
  /** The WO as the file writes it, and its Corrigo form (WO-0855) and match key; "" when the row has none. */
  woRaw: string | null;
  wo: string;
  woKey: string;
  usedOnRaw: string | null;
  /** YYYY-MM-DD; null when blank, undefined when it can't be read. */
  usedOn: string | null | undefined;
  item: string | null;
  sku: string;
  qtyRaw: string | null;
  /** Null when it can't be read. A blank qty is 1, with qtyBlank. */
  qty: number | null;
  qtyBlank: boolean;
  sourceRaw: string | null;
  source: LineSource | null;
  sourceRef: string | null;
};

type Field = "wo" | "usedOn" | "item" | "qty" | "source" | "sourceRef";

const COLUMN: Record<string, Field> = {
  wo: "wo",
  wono: "wo",
  wonumber: "wo",
  workorder: "wo",
  usedon: "usedOn",
  date: "usedOn",
  item: "item",
  itemname: "item",
  qty: "qty",
  quantity: "qty",
  source: "source",
  sourceref: "sourceRef",
  ref: "sourceRef",
};
const head = (v: unknown) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
const cell = (v: unknown) => {
  const t = String(v ?? "").trim();
  return t ? t : null;
};
const NEEDS = "The file needs the columns wo, used_on, item and source (qty and source_ref are optional).";

/** The rows under the header: wo, used_on, item, qty, source, source_ref, in any order, with spaces or underscores. */
export function woRowsFromSheets(sheets: { name: string; matrix: unknown[][] }[]): { rows: WoLineRow[] } {
  for (const sheet of sheets) {
    const at = sheet.matrix.slice(0, 10).findIndex((r) => Array.isArray(r) && r.some((v) => COLUMN[head(v)]));
    if (at < 0) continue;
    const cols = new Map<number, Field>();
    (sheet.matrix[at] as unknown[]).forEach((v, i) => {
      const k = COLUMN[head(v)];
      if (k && ![...cols.values()].includes(k)) cols.set(i, k);
    });
    const has = (k: Field) => [...cols.values()].includes(k);
    if (!has("wo") || !has("usedOn") || !has("item") || !has("source")) throw new Error(NEEDS);
    const rows: WoLineRow[] = [];
    sheet.matrix.slice(at + 1).forEach((r, i) => {
      if (!Array.isArray(r) || !r.some((v) => cell(v))) return;
      const get = (k: Field) => {
        for (const [c, name] of cols) if (name === k) return cell(r[c]);
        return null;
      };
      const woRaw = get("wo");
      const usedOnRaw = get("usedOn");
      const item = get("item");
      const qtyRaw = get("qty");
      const sourceRaw = get("source");
      const qty = readQty(qtyRaw);
      rows.push({
        line: at + i + 2,
        woRaw,
        wo: woRaw ? woCanonical(woRaw) : "",
        woKey: woRaw ? woMatchKey(woRaw) : "",
        usedOnRaw,
        usedOn: readUsedOn(usedOnRaw),
        item,
        sku: lineSku(item),
        qtyRaw,
        qty: qty ? qty.qty : null,
        qtyBlank: !!qty?.blank,
        sourceRaw,
        source: readSource(sourceRaw),
        sourceRef: get("sourceRef"),
      });
    });
    return { rows };
  }
  throw new Error(NEEDS);
}

/** A KatzDesk ticket carrying a WO: a service or TLC ticket, a PM or an install. */
export type WoTicket = {
  board: "service" | "tlc" | "pm" | "install";
  id: number;
  /** The WO as the ticket carries it. */
  wo: string;
  /** "SC-1042 · WO-0855" for a ticket; the WO for a PM or an install. */
  label: string;
  customer: string | null;
  status: string | null;
  /** YYYY-MM-DD it came in (else its first activity, else when it was completed), and when it was completed. */
  received: string | null;
  completedAt: string | null;
  /** Where its parts count in Parts usage: "service:12", or for a PM billed on a ticket, that ticket. */
  countsOn: string;
};

/**
 * How far a line's day may be from the day its ticket came in. The WO numbers started over in July 2026, so the same
 * number from the run before came in years earlier.
 */
export const TICKET_WINDOW = { before: 180, after: 14 } as const;

const dayNumber = (iso: string) => Math.round(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / 86_400_000);
const BOARD_ORDER: Record<WoTicket["board"], number> = { service: 0, tlc: 0, pm: 1, install: 2 };

/**
 * The ticket a line was used on: one with the line's WO that came in from 180 days before the line's day to 14 days
 * after it. A service or TLC ticket comes before a PM, and a PM before an install; then the nearest day.
 */
export function ticketForLine(row: { woKey: string; usedOn: string | null | undefined }, tickets: WoTicket[]): WoTicket | null {
  if (!row.woKey || !row.usedOn) return null;
  const used = dayNumber(row.usedOn);
  const fits = tickets
    .filter((t) => woMatchKey(t.wo) === row.woKey && (t.received ?? t.completedAt))
    .map((t) => ({ t, gap: used - dayNumber((t.received ?? t.completedAt)!) }))
    .filter(({ gap }) => gap <= TICKET_WINDOW.before && gap >= -TICKET_WINDOW.after);
  fits.sort((a, b) => BOARD_ORDER[a.t.board] - BOARD_ORDER[b.t.board] || Math.abs(a.gap) - Math.abs(b.gap) || b.t.id - a.t.id);
  return fits[0]?.t ?? null;
}

/** A part on the list, as a line's SKU finds it. */
export type LinePart = { id: number; sku: string; item: string; description: string | null };

export type WoLineStatus = "add" | "combined" | "duplicate" | "no_part" | "no_wo" | "counted" | "invalid";

export type WoLinePlanLine = WoLineRow & {
  status: WoLineStatus;
  /** Why it is skipped, or a note on a line that is added. */
  reason: string | null;
  part: LinePart | null;
  ticket: WoTicket | null;
  /** A row that adds a line: the pieces saved (its own and the rows added to it), and whether one of them was blank. */
  total: number | null;
  totalBlank: boolean;
  /** The source_refs saved with it. */
  refs: string[];
  /** A row added to an earlier one: that row's line. */
  into: number | null;
};

export type WoLineFacts = {
  /** The part each SKU names: by a part's item after its last colon, else its SKU. */
  partBySku: Map<string, LinePart>;
  /** Every ticket carrying one of the file's WOs, on any board. */
  tickets: WoTicket[];
  /** "WO-0855|BUNN40670.0005|corrigo" for each line already saved. */
  saved: Set<string>;
  /** "service:12|345": a part the ticket already counts, from Charges, an invoice, a PM's logged parts or QuickBooks. */
  ticketUses: Set<string>;
  /** QuickBooks history work orders with one of the file's WOs: the WO, its day, and the parts on it. */
  history: { woKey: string; wo: string; day: string | null; partIds: number[] }[];
};

const near = (a: string | null, b: string, days: number) => !!a && Math.abs(dayNumber(a) - dayNumber(b)) <= days;

/**
 * What each row does. Skipped: no WO; a source other than corrigo or netsuite, a missing or unreadable date or qty, or
 * no item; and an item no part has. Rows with the same WO, part and source make one line: their pieces add up, except a
 * row whose source_ref an earlier one has (the same line twice). A line is skipped when it is already saved, when its
 * pieces add up to 0 or less, or when the WO's part is already counted: on its ticket (Charges, an invoice, a PM's logged
 * parts or QuickBooks attached to it), in the QuickBooks history for that WO, or, for NetSuite, by Corrigo's line. The
 * rest are added, on their ticket, or with no ticket on their WO.
 */
export function planWoLines(rows: WoLineRow[], facts: WoLineFacts): WoLinePlanLine[] {
  const lines: WoLinePlanLine[] = rows.map((r) => ({
    ...r,
    status: "add",
    reason: null,
    part: r.sku ? (facts.partBySku.get(r.sku) ?? null) : null,
    ticket: null,
    total: null,
    totalBlank: false,
    refs: [],
    into: null,
  }));
  const skip = (l: WoLinePlanLine, status: WoLineStatus, reason: string) => {
    l.status = status;
    l.reason = reason;
  };
  for (const l of lines) {
    if (!l.woKey) skip(l, "no_wo", "No WO");
    else if (!l.source) skip(l, "invalid", `Source "${l.sourceRaw ?? ""}": corrigo or netsuite`);
    else if (l.usedOn === null) skip(l, "invalid", "No date");
    else if (l.usedOn === undefined) skip(l, "invalid", "Can't read the date");
    else if (l.qty == null) skip(l, "invalid", "Can't read the qty");
    else if (!l.sku) skip(l, "invalid", "No item");
    else if (!l.part) skip(l, "no_part", `No part has SKU ${l.sku}`);
  }

  // One line per WO, part and source.
  const leads = new Map<string, WoLinePlanLine>();
  const members = new Map<WoLinePlanLine, WoLinePlanLine[]>();
  for (const l of lines) {
    if (l.status !== "add") continue;
    const key = `${l.wo}|${l.sku}|${l.source}`;
    const lead = leads.get(key);
    if (!lead) {
      leads.set(key, l);
      members.set(l, []);
      l.total = l.qty;
      l.totalBlank = l.qtyBlank;
      l.refs = l.sourceRef ? [l.sourceRef] : [];
      continue;
    }
    if (l.sourceRef && lead.refs.includes(l.sourceRef)) {
      skip(l, "duplicate", `Line ${lead.line} has the same source_ref`);
      continue;
    }
    l.status = "combined";
    l.reason = `Added to line ${lead.line}`;
    l.into = lead.line;
    lead.total = Math.round((lead.total! + l.qty!) * 100) / 100;
    lead.totalBlank ||= l.qtyBlank;
    if (l.sourceRef) lead.refs.push(l.sourceRef);
    members.get(lead)!.push(l);
  }

  // Corrigo's lines first: NetSuite's line for the same WO and part doesn't count when Corrigo has one.
  const ordered = [...leads.values()].sort((a, b) => (a.source === b.source ? a.line - b.line : a.source === "corrigo" ? -1 : 1));
  const corrigo = new Set<string>();
  for (const l of ordered) {
    const key = `${l.wo}|${l.sku}|${l.source}`;
    const part = l.part!;
    const ticket = ticketForLine(l, facts.tickets);
    l.ticket = ticket;
    const history = facts.history.find((h) => h.woKey === l.woKey && h.partIds.includes(part.id) && near(h.day, l.usedOn!, TICKET_WINDOW.before));
    if (facts.saved.has(key)) skip(l, "duplicate", "Already imported");
    else if (l.total! <= 0) skip(l, "invalid", "The qty adds up to 0 or less");
    else if (l.source === "netsuite" && (corrigo.has(`${l.wo}|${l.sku}`) || facts.saved.has(`${l.wo}|${l.sku}|corrigo`))) {
      skip(l, "counted", `Corrigo has this part on ${l.wo}`);
    } else if (ticket && facts.ticketUses.has(`${ticket.countsOn}|${part.id}`)) {
      skip(l, "counted", `Already counted on ${ticket.label}`);
    } else if (history) skip(l, "counted", `Already in the QuickBooks history (${history.wo})`);
    else {
      if (l.source === "corrigo") corrigo.add(`${l.wo}|${l.sku}`);
      const notes = [
        ticket ? null : "No ticket: saved on its WO",
        l.source === "corrigo" && facts.saved.has(`${l.wo}|${l.sku}|netsuite`) ? "Counts instead of the NetSuite line" : null,
        l.totalBlank ? "A blank qty counts as 1" : null,
      ].filter(Boolean);
      l.reason = notes.length ? notes.join(" · ") : null;
    }
    // The rows added to it go with it.
    if (l.status !== "add") {
      for (const m of members.get(l) ?? []) {
        m.status = l.status;
        m.reason = `With line ${l.line}: ${l.reason}`;
      }
    }
  }
  return lines;
}

export type WoLineCounts = {
  add: number;
  /** Of those added, the ones on no ticket. */
  noTicket: number;
  combined: number;
  duplicate: number;
  noPart: number;
  noWo: number;
  counted: number;
  invalid: number;
};

export function woLineCounts(plan: WoLinePlanLine[]): WoLineCounts {
  const n = (s: WoLineStatus) => plan.filter((l) => l.status === s).length;
  return {
    add: n("add"),
    noTicket: plan.filter((l) => l.status === "add" && !l.ticket).length,
    combined: n("combined"),
    duplicate: n("duplicate"),
    noPart: n("no_part"),
    noWo: n("no_wo"),
    counted: n("counted"),
    invalid: n("invalid"),
  };
}
