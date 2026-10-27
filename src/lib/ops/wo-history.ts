/**
 * Work Order History import (Chuy, 2026-10-27): completed work orders from the old ticket system, 2024–2026, with
 * their QuickBooks invoice lines, from two CSVs Claude built (KatzDesk_WO_History_WorkOrders.csv and
 * KatzDesk_WO_History_Items.csv).
 *
 * - Columns are read by header name, never by position.
 * - History Ref is the key: WO numbers restarted in July 2026, so a reused WO # reads "WO-0211 (2026-07-24)".
 * - A row goes on the account named by Service Location (exact name, ignoring case and extra spaces; never fuzzy).
 *   Location Source "Missing" rows go on their parent account (Walk - In / Cimbali National Accounts) and are listed
 *   as Location Needed.
 * - A KatzDesk ticket with the same WO # on that account, received 0–90 days before the work was completed, gets the
 *   history attached instead of a second ticket. Two such tickets: Ambiguous, not saved.
 * - A tech who isn't on the active roster: the history goes to Jesus Garcia with "Done by <tech>", and the real name
 *   is kept.
 * - The invoice is read-only history: lines exactly as billed, Discount lines summed into one discount.
 *
 * Pure: no server imports, safe for node --test.
 */
import { isCimbaliName, isWalkInName, leafOf, parentOf } from "./clean-names.ts";
import { normalizeCustomerKey } from "./customer-key.ts";
import { sameTech } from "./tech-match.ts";

// ── CSV ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** RFC 4180 CSV: quoted cells may hold commas, line breaks and "" for a quote. A leading BOM is dropped. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"' && cell === "") {
      quoted = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\r" || c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += c === "\r" && s[i + 1] === "\n" ? 2 : 1;
      continue;
    }
    cell += c;
    i++;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // A blank line is not a row.
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

// ── Reading the two files ────────────────────────────────────────────────────────────────────────────────────────────

export const ORDER_COLUMNS = {
  ref: "History Ref",
  wo: "WO #",
  completed: "Completed",
  customer: "Customer",
  serviceLocation: "Service Location",
  locationSource: "Location Source",
  tech: "Tech",
  techStatus: "Tech Status",
  callCategory: "Call Category",
  serviceType: "Service Type",
  problem: "Problem Description",
  workDone: "Work Done",
  partsUsed: "Parts Used",
  laborHours: "Labor Hrs",
  tripCharges: "Trip Charges",
  partsAmount: "Parts $",
  invoiceTotal: "Invoice Total",
  po: "PO #",
  invoiceDate: "Invoice Date",
  hasItems: "Has Items",
  reviewFlags: "Review Flags",
} as const;

export const LINE_COLUMNS = {
  ref: "History Ref",
  lineType: "Line Type",
  itemCode: "Item Code",
  description: "Item Description",
  itemClass: "Item Class",
  itemGroup: "Item Group",
  qty: "Qty",
  unitPrice: "Unit Price",
  amount: "Amount",
  invoiceDate: "Invoice Date",
  invoiceCustomer: "Invoice Customer",
} as const;

/** Columns a file must have. The rest are read when present. */
const ORDER_REQUIRED: (keyof typeof ORDER_COLUMNS)[] = ["ref", "wo", "completed", "customer", "serviceLocation", "locationSource", "tech"];
const LINE_REQUIRED: (keyof typeof LINE_COLUMNS)[] = ["ref", "lineType", "itemCode", "amount"];

export type WoOrder = {
  ref: string;
  wo: string;
  /** "YYYY-MM-DD HH:MM", US Central, as the file has it. */
  completed: string;
  customer: string;
  serviceLocation: string;
  locationSource: string;
  tech: string;
  techStatus: string;
  callCategory: string;
  serviceType: string;
  problem: string;
  workDone: string;
  partsUsed: string;
  laborHours: number | null;
  /** A count, not dollars. */
  tripCharges: number | null;
  /** Parts, filters and equipment, in dollars. */
  partsAmount: number | null;
  invoiceTotal: number | null;
  po: string;
  invoiceDate: string | null;
  /** Yes / No (no charge) / No / No (after export). */
  hasItems: string;
  reviewFlags: string;
};

export type WoLine = {
  ref: string;
  lineType: string;
  itemCode: string;
  description: string;
  itemClass: string;
  itemGroup: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  invoiceDate: string | null;
  invoiceCustomer: string;
};

export type WoRead = {
  orders: WoOrder[];
  lines: WoLine[];
  /** Anything that stops the import: nothing is previewed or saved while there are problems. */
  problems: string[];
};

const MAX_PROBLEMS = 25;

function headerIndex<K extends string>(head: string[], columns: Record<K, string>): Record<K, number> {
  const at = new Map(head.map((h, i) => [h.trim().toLowerCase(), i] as const));
  const out = {} as Record<K, number>;
  for (const k of Object.keys(columns) as K[]) out[k] = at.get(columns[k].toLowerCase()) ?? -1;
  return out;
}

/** A number as the file writes it: "1,234.50", "$12", "-3". Blank is null; anything else is NaN. */
export function readNumber(raw: string | undefined): number | null {
  const t = String(raw ?? "").replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** "YYYY-MM-DD HH:MM" (or with seconds, or a date alone). Returns the text as "YYYY-MM-DD HH:MM", or null. */
export function readCompleted(raw: string | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(String(raw ?? "").trim());
  if (!m) return null;
  const [, y, mo, d, h = "00", mi = "00"] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31 || Number(h) > 23 || Number(mi) > 59) return null;
  return `${y}-${mo}-${d} ${h.padStart(2, "0")}:${mi}`;
}

/** "YYYY-MM-DD" (a time after it is dropped). Blank is null; anything else is undefined. */
export function readDay(raw: string | undefined): string | null | undefined {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/.exec(t);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

/** Read both files and check them. Line numbers in problems are the file's own (the header is line 1). */
export function readWoHistory(ordersText: string, linesText: string): WoRead {
  const problems: string[] = [];
  const problem = (p: string) => {
    if (problems.length < MAX_PROBLEMS) problems.push(p);
  };
  const oRows = parseCsv(ordersText);
  const lRows = parseCsv(linesText);
  if (!oRows.length) return { orders: [], lines: [], problems: ["The Work Orders file is empty."] };
  if (!lRows.length) return { orders: [], lines: [], problems: ["The Items file is empty."] };
  const oi = headerIndex(oRows[0]!, ORDER_COLUMNS);
  const li = headerIndex(lRows[0]!, LINE_COLUMNS);
  const missingO = ORDER_REQUIRED.filter((k) => oi[k] < 0).map((k) => ORDER_COLUMNS[k]);
  const missingL = LINE_REQUIRED.filter((k) => li[k] < 0).map((k) => LINE_COLUMNS[k]);
  if (missingO.length) problems.push(`The Work Orders file has no ${missingO.map((c) => `“${c}”`).join(", ")} column.`);
  if (missingL.length) problems.push(`The Items file has no ${missingL.map((c) => `“${c}”`).join(", ")} column.`);
  if (problems.length) return { orders: [], lines: [], problems };

  const cellOf = <K extends string>(idx: Record<K, number>, row: string[]) => (k: K) => (idx[k] >= 0 ? String(row[idx[k]] ?? "").trim() : "");
  const orders: WoOrder[] = [];
  const seen = new Map<string, number>();
  oRows.slice(1).forEach((row, n) => {
    const line = n + 2;
    const c = cellOf(oi, row);
    const ref = c("ref");
    if (!ref) return problem(`Work Orders line ${line}: no History Ref.`);
    const key = ref.toLowerCase();
    if (seen.has(key)) return problem(`Work Orders line ${line}: History Ref ${ref} is also on line ${seen.get(key)}.`);
    seen.set(key, line);
    const completed = readCompleted(c("completed"));
    if (!completed) problem(`Work Orders line ${line} (${ref}): Completed “${c("completed")}” isn't a date (YYYY-MM-DD HH:MM).`);
    const num = (k: "laborHours" | "tripCharges" | "partsAmount" | "invoiceTotal") => {
      const v = readNumber(c(k));
      if (Number.isNaN(v)) problem(`Work Orders line ${line} (${ref}): ${ORDER_COLUMNS[k]} “${c(k)}” isn't a number.`);
      return v;
    };
    const invoiceDate = readDay(c("invoiceDate"));
    if (invoiceDate === undefined) problem(`Work Orders line ${line} (${ref}): Invoice Date “${c("invoiceDate")}” isn't a date.`);
    orders.push({
      ref,
      wo: c("wo"),
      completed: completed ?? "",
      customer: c("customer"),
      serviceLocation: c("serviceLocation"),
      locationSource: c("locationSource"),
      tech: c("tech"),
      techStatus: c("techStatus"),
      callCategory: c("callCategory"),
      serviceType: c("serviceType"),
      problem: c("problem"),
      workDone: c("workDone"),
      partsUsed: c("partsUsed"),
      laborHours: num("laborHours"),
      tripCharges: num("tripCharges"),
      partsAmount: num("partsAmount"),
      invoiceTotal: num("invoiceTotal"),
      po: c("po"),
      invoiceDate: invoiceDate ?? null,
      hasItems: c("hasItems"),
      reviewFlags: c("reviewFlags"),
    });
  });

  const lines: WoLine[] = [];
  const unknownRefs = new Set<string>();
  lRows.slice(1).forEach((row, n) => {
    const line = n + 2;
    const c = cellOf(li, row);
    const ref = c("ref");
    if (!ref) return problem(`Items line ${line}: no History Ref.`);
    if (!seen.has(ref.toLowerCase())) {
      if (!unknownRefs.has(ref)) problem(`Items line ${line}: History Ref ${ref} isn't in the Work Orders file.`);
      unknownRefs.add(ref);
      return;
    }
    const num = (k: "qty" | "unitPrice" | "amount") => {
      const v = readNumber(c(k));
      if (Number.isNaN(v)) problem(`Items line ${line} (${ref}): ${LINE_COLUMNS[k]} “${c(k)}” isn't a number.`);
      return v;
    };
    const lineType = c("lineType");
    if (!(lineType in LINE_KIND)) problem(`Items line ${line} (${ref}): Line Type “${lineType}” isn't one of ${Object.keys(LINE_KIND).join(", ")}.`);
    const invoiceDate = readDay(c("invoiceDate"));
    if (invoiceDate === undefined) problem(`Items line ${line} (${ref}): Invoice Date “${c("invoiceDate")}” isn't a date.`);
    lines.push({
      ref,
      lineType,
      itemCode: c("itemCode"),
      description: c("description"),
      itemClass: c("itemClass"),
      itemGroup: c("itemGroup"),
      qty: num("qty"),
      unitPrice: num("unitPrice"),
      amount: num("amount"),
      invoiceDate: invoiceDate ?? null,
      invoiceCustomer: c("invoiceCustomer"),
    });
  });
  if (!orders.length && !problems.length) problems.push("The Work Orders file has no rows under the header.");
  return { orders, lines, problems };
}

/** Cimbali's own ticket number in the PO # column: SRV and 4–5 digits ("SRV1347", "SRV39266"). */
export function srvOf(po: string | null | undefined): string | null {
  const t = String(po ?? "").trim();
  return /^SRV\d{4,5}$/i.test(t) ? t.toUpperCase() : null;
}

// ── Names ────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Exact-name key: case and extra spaces don't count, punctuation does. */
export const nameKey = (s: string | null | undefined) => String(s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

/** The parent a QuickBooks child name is billed under, when it is a Walk-In or Cimbali parent. */
export function billedParent(name: string): string | null {
  const p = parentOf(name);
  return p && (isWalkInName(p) || isCimbaliName(p)) ? p : null;
}

export type RenameAccount = { id: number; name: string; archived: boolean; nameLocked: boolean };

export type RenamePlanLine = {
  id: number;
  from: string;
  to: string;
  /** prefix: drop "Walk - In:" / "Cimbali National Accounts:". punctuation: match the file's spelling. */
  kind: "prefix" | "punctuation";
  /** The parent the account is billed under (prefix renames). */
  parent: string | null;
  walkIn: boolean;
  status: "ok" | "collision";
  reason: string | null;
  /** The name is locked from the clean customer list. */
  locked: boolean;
};

/**
 * The account renames that come before the import, for Chuy to tick:
 * - every account named "Walk - In:<place>" or "Cimbali National Accounts:<place>" drops the prefix (it keeps the
 *   parent and the Walk-In mark in their own fields);
 * - a Service Location in the file that no account has exactly, where one account differs from it only in
 *   punctuation ("McIntyre's Richmond" vs "McIntyre's - Richmond"), takes the file's spelling.
 * A rename whose new name another account already has, or that two renames share, is held (Collision).
 */
export function planAccountRenames(accounts: RenameAccount[], fileLocations: string[]): RenamePlanLine[] {
  const live = accounts.filter((a) => !a.archived);
  const out: RenamePlanLine[] = [];
  for (const a of live) {
    const parent = billedParent(a.name);
    if (!parent) continue;
    const to = leafOf(a.name);
    if (!to) continue;
    out.push({ id: a.id, from: a.name, to, kind: "prefix", parent, walkIn: isWalkInName(parent), status: "ok", reason: null, locked: a.nameLocked });
  }
  const byName = new Set(accounts.map((a) => nameKey(a.name)));
  const renamedTo = new Set(out.map((r) => nameKey(r.to)));
  const byPunct = new Map<string, RenameAccount[]>();
  for (const a of live) {
    const k = normalizeCustomerKey(a.name);
    if (k) byPunct.set(k, [...(byPunct.get(k) ?? []), a]);
  }
  const taken = new Set(out.map((r) => r.id));
  const seenLoc = new Set<string>();
  for (const loc of fileLocations) {
    const want = loc.trim().replace(/\s+/g, " ");
    const k = nameKey(want);
    if (!want || seenLoc.has(k) || byName.has(k) || renamedTo.has(k)) continue;
    seenLoc.add(k);
    if (billedParent(want) || isWalkInName(want)) continue;
    const hits = (byPunct.get(normalizeCustomerKey(want)) ?? []).filter((a) => !taken.has(a.id));
    if (hits.length !== 1) continue;
    const a = hits[0]!;
    taken.add(a.id);
    out.push({ id: a.id, from: a.name, to: want, kind: "punctuation", parent: null, walkIn: false, status: "ok", reason: null, locked: a.nameLocked });
  }
  // Collisions: the new name is already an account (other than this one), or two renames want it.
  const wanted = new Map<string, number>();
  for (const r of out) wanted.set(nameKey(r.to), (wanted.get(nameKey(r.to)) ?? 0) + 1);
  for (const r of out) {
    const holder = accounts.find((a) => a.id !== r.id && nameKey(a.name) === nameKey(r.to));
    if (holder) {
      r.status = "collision";
      r.reason = holder.archived
        ? `A removed account is named “${holder.name}”. Restore or rename it on Customers first.`
        : `“${holder.name}” is already an account. Merge them on Customers if they are one place.`;
    } else if ((wanted.get(nameKey(r.to)) ?? 0) > 1) {
      r.status = "collision";
      r.reason = `More than one account would be renamed “${r.to}”.`;
    }
  }
  return out.sort((x, y) => x.kind.localeCompare(y.kind) || x.from.localeCompare(y.from));
}

// ── Planning the import ──────────────────────────────────────────────────────────────────────────────────────────────

/** Old techs' work goes to this tech, with "Done by <tech>". */
export const HISTORY_FALLBACK_TECH = "Jesus Garcia";

/** Days before completion a KatzDesk ticket's received date may be and still be the same work order. */
export const ATTACH_WINDOW_DAYS = 90;

export type PlanAccount = { id: number; name: string; archived: boolean };

export type PlanTicket = {
  id: number;
  wo: string | null;
  customer: string | null;
  /** YYYY-MM-DD */
  received: string | null;
  /** updated_at as text: a save skips the ticket if it changed after the preview. */
  updatedAt: string;
  workDone: string | null;
  completedAt: string | null;
  duplicateOf: number | null;
};

/** What a row needs for planning; the preview sends only these. */
export type WoPlanInput = Pick<WoOrder, "ref" | "wo" | "completed" | "customer" | "serviceLocation" | "locationSource" | "tech">;

export type WoStatus = "create" | "attach" | "removed" | "unmatched" | "ambiguous" | "same";

export const WO_STATUS_LABEL: Record<WoStatus, string> = {
  create: "Will Create",
  attach: "Attach To Existing Ticket",
  removed: "Removed Account",
  unmatched: "Unmatched Account",
  ambiguous: "Ambiguous",
  same: "No Change",
};

export type WoPlanLine = {
  ref: string;
  status: WoStatus;
  /** The KatzDesk account it goes on (or the removed account's name). */
  account: string | null;
  /** The name it was looked up by: the Service Location, or the parent for Location Needed rows. */
  lookup: string;
  /** No Service Location: saved on the parent account, listed as Location Needed. */
  locationNeeded: boolean;
  jobId: number | null;
  /** The ticket's updated_at when planned. */
  seen: string | null;
  technician: string;
  /** The file's tech when they aren't on the active roster. */
  originalTech: string | null;
  reason: string | null;
};

/** Saveable rows start ticked except removed accounts. */
export const isSaveable = (s: WoStatus) => s === "create" || s === "attach" || s === "removed";
export const startsTicked = (s: WoStatus) => s === "create" || s === "attach";

function dayNumber(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  return Date.UTC(y!, (m ?? 1) - 1, d ?? 1) / 86_400_000;
}

/** The roster name this tech is on, or the fallback tech with the original kept. */
export function historyTech(tech: string, activeTechs: string[]): { technician: string; originalTech: string | null } {
  // "Elias Banda (deleted)" is Elias Banda.
  const t = tech.replace(/\s*\((deleted|inactive)\)\s*$/i, "").replace(/\.+$/, "").trim();
  const hit = t ? activeTechs.find((a) => sameTech(a, t)) : undefined;
  if (hit) return { technician: hit, originalTech: null };
  return { technician: HISTORY_FALLBACK_TECH, originalTech: t || null };
}

export const techNote = (originalTech: string | null) => (originalTech ? `Done by ${originalTech}` : null);

/**
 * Plan every row against KatzDesk as it is now. Saves nothing.
 * `savedRefs`: History Refs already imported. `linkedJobs`: tickets already holding a history row.
 */
export function planWoHistory(
  orders: WoPlanInput[],
  ctx: { accounts: PlanAccount[]; activeTechs: string[]; savedRefs: Set<string>; tickets: PlanTicket[]; linkedJobs: Set<number> },
): WoPlanLine[] {
  const active = new Map<string, PlanAccount[]>();
  const removed = new Map<string, PlanAccount[]>();
  for (const a of ctx.accounts) {
    const m = a.archived ? removed : active;
    m.set(nameKey(a.name), [...(m.get(nameKey(a.name)) ?? []), a]);
  }
  const byWo = new Map<string, PlanTicket[]>();
  for (const t of ctx.tickets) {
    if (t.duplicateOf || !t.wo) continue;
    byWo.set(nameKey(t.wo), [...(byWo.get(nameKey(t.wo)) ?? []), t]);
  }
  const claimed = new Set(ctx.linkedJobs);
  const saved = new Set([...ctx.savedRefs].map((r) => r.toLowerCase()));
  return orders.map((o) => {
    const locationNeeded = o.locationSource.trim().toLowerCase() === "missing" || !o.serviceLocation.trim();
    const lookup = (locationNeeded ? o.customer : o.serviceLocation).trim();
    const tech = historyTech(o.tech, ctx.activeTechs);
    const base = { ref: o.ref, lookup, locationNeeded, jobId: null, seen: null, ...tech, reason: null } as const;
    if (saved.has(o.ref.toLowerCase())) return { ...base, status: "same", account: lookup, reason: "Already imported." };
    const live = active.get(nameKey(lookup)) ?? [];
    if (!live.length) {
      const gone = removed.get(nameKey(lookup)) ?? [];
      if (gone.length)
        return { ...base, status: "removed", account: gone[0]!.name, reason: `“${gone[0]!.name}” was removed from Customers. Ticked, it saves on the removed account without restoring it.` };
      return {
        ...base,
        status: "unmatched",
        account: null,
        reason: locationNeeded ? `No account named “${lookup}” for the Location Needed rows.` : `No account named “${lookup}”. Fix the name on Clean Names, then read the files again.`,
      };
    }
    const account = live[0]!.name;
    const done = o.completed ? dayNumber(o.completed) : null;
    const hits =
      done == null
        ? []
        : (byWo.get(nameKey(o.wo)) ?? []).filter((t) => {
            if (nameKey(t.customer) !== nameKey(account) || !t.received) return false;
            const gap = done - dayNumber(t.received);
            return gap >= 0 && gap <= ATTACH_WINDOW_DAYS;
          });
    if (hits.length > 1)
      return { ...base, status: "ambiguous", account, reason: `${hits.length} KatzDesk tickets have ${o.wo} on this account within ${ATTACH_WINDOW_DAYS} days: #${hits.map((t) => t.id).join(", #")}.` };
    if (hits.length === 1) {
      const t = hits[0]!;
      if (claimed.has(t.id)) return { ...base, status: "ambiguous", account, reason: `Ticket #${t.id} (${o.wo}) already has another history row.` };
      claimed.add(t.id);
      return { ...base, status: "attach", account, jobId: t.id, seen: t.updatedAt, reason: `KatzDesk ticket #${t.id} (${t.wo}, received ${t.received}).` };
    }
    return { ...base, status: "create", account };
  });
}

export type WoCounts = Record<WoStatus, number> & { locationNeeded: number; remapped: number };

export function countWoPlan(lines: WoPlanLine[]): WoCounts {
  const c: WoCounts = { create: 0, attach: 0, removed: 0, unmatched: 0, ambiguous: 0, same: 0, locationNeeded: 0, remapped: 0 };
  for (const l of lines) {
    c[l.status]++;
    if (l.locationNeeded && isSaveable(l.status)) c.locationNeeded++;
    if (l.originalTech && isSaveable(l.status)) c.remapped++;
  }
  return c;
}

/** Tickets that go to the fallback tech, by the tech who did them. */
export function remappedByTech(lines: WoPlanLine[]): { tech: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of lines) if (l.originalTech && isSaveable(l.status)) m.set(l.originalTech, (m.get(l.originalTech) ?? 0) + 1);
  return [...m].map(([tech, count]) => ({ tech, count })).sort((a, b) => b.count - a.count || a.tech.localeCompare(b.tech));
}

/** Names with no account, with how many rows each. */
export function unmatchedNames(lines: WoPlanLine[]): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of lines) if (l.status === "unmatched") m.set(l.lookup, (m.get(l.lookup) ?? 0) + 1);
  return [...m].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// ── The history invoice ──────────────────────────────────────────────────────────────────────────────────────────────

/** Line Type → the line's kind. Discount lines become the invoice's one discount. */
export const LINE_KIND: Record<string, string> = {
  Part: "part",
  Filter: "filter",
  Equipment: "equipment",
  Labor: "labor",
  "Trip Charge": "trip",
  "Install Fee": "install",
  Service: "service",
  "Other Charge": "other",
  Discount: "discount",
};

/** "WO-0211 · 2026-07-24": the WO # (or History Ref) and the day it was completed. */
export function historyTitle(h: { ref: string; wo: string | null; completed: string | null }, day: (ymd: string) => string = (d) => d): string {
  return `${h.wo || h.ref} · ${h.completed ? day(h.completed.slice(0, 10)) : "—"}`;
}

/** "Apr 1, 2025": history spans years, so the year always shows. */
export function historyDay(ymd: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? ""));
  if (!m) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** Labor and trip are labor; everything else is parts, as on the Invoice window. */
export const isHistoryLabor = (kind: string) => kind === "labor" || kind === "trip";

const cents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type HistoryInvoiceLine = Pick<WoLine, "lineType" | "itemCode" | "description" | "qty" | "unitPrice" | "amount" | "invoiceDate"> & { kind: string };

export type HistoryInvoice = {
  lines: HistoryInvoiceLine[];
  parts: number;
  labor: number;
  subtotal: number;
  /** Dollars off (positive), the Discount lines added up. */
  discount: number;
  total: number;
  /** The earliest line's invoice date. */
  invoiceDate: string | null;
};

/** The invoice the lines make: Amount as billed (never qty × price), Discount lines summed into one discount. */
export function historyInvoice(lines: Pick<WoLine, "lineType" | "itemCode" | "description" | "qty" | "unitPrice" | "amount" | "invoiceDate">[]): HistoryInvoice {
  let parts = 0;
  let labor = 0;
  let discount = 0;
  const out: HistoryInvoiceLine[] = [];
  let invoiceDate: string | null = null;
  for (const l of lines) {
    if (l.invoiceDate && (!invoiceDate || l.invoiceDate < invoiceDate)) invoiceDate = l.invoiceDate;
    const kind = LINE_KIND[l.lineType] ?? "other";
    const amount = l.amount ?? 0;
    if (kind === "discount") {
      discount += -amount;
      continue;
    }
    if (isHistoryLabor(kind)) labor += amount;
    else parts += amount;
    out.push({ ...l, kind });
  }
  const subtotal = cents(parts + labor);
  return { lines: out, parts: cents(parts), labor: cents(labor), subtotal, discount: cents(discount), total: cents(subtotal - discount), invoiceDate };
}

/** The line total and QuickBooks' invoice total disagree (tax, freight, a line on another invoice). */
export const totalsDiffer = (total: number, qbTotal: number | null) => qbTotal != null && Math.abs(total - qbTotal) >= 0.02;

// ── Batches ──────────────────────────────────────────────────────────────────────────────────────────────────────────

export const SAVE_BATCH_ORDERS = 250;
export const SAVE_BATCH_BYTES = 1_000_000;

/** Work orders with their lines, in batches of up to 250 orders and under 1 MB. An order and its lines stay together. */
export function saveBatches(orders: WoOrder[], lines: WoLine[], maxOrders = SAVE_BATCH_ORDERS, maxBytes = SAVE_BATCH_BYTES): { orders: WoOrder[]; lines: WoLine[] }[] {
  const byRef = new Map<string, WoLine[]>();
  for (const l of lines) byRef.set(l.ref.toLowerCase(), [...(byRef.get(l.ref.toLowerCase()) ?? []), l]);
  const enc = new TextEncoder();
  const out: { orders: WoOrder[]; lines: WoLine[] }[] = [];
  let cur: { orders: WoOrder[]; lines: WoLine[] } = { orders: [], lines: [] };
  let size = 0;
  for (const o of orders) {
    const own = byRef.get(o.ref.toLowerCase()) ?? [];
    const n = enc.encode(JSON.stringify(o)).length + enc.encode(JSON.stringify(own)).length + 2;
    if (cur.orders.length && (cur.orders.length >= maxOrders || size + n > maxBytes)) {
      out.push(cur);
      cur = { orders: [], lines: [] };
      size = 0;
    }
    cur.orders.push(o);
    cur.lines.push(...own);
    size += n;
  }
  if (cur.orders.length) out.push(cur);
  return out;
}
