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

export type PlanAccount = { id: number; name: string; archived: boolean; inactive?: boolean };

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
  technician?: string | null;
  issue?: string | null;
};

/** What a row needs for planning. Only the first seven are needed to place it; the rest fill blanks on a saved row. */
export type WoPlanInput = Pick<WoOrder, "ref" | "wo" | "completed" | "customer" | "serviceLocation" | "locationSource" | "tech"> & Partial<WoOrder>;

export type WoStatus = "create" | "attach" | "retire" | "fill" | "addLines" | "removed" | "unmatched" | "ambiguous" | "same";

export const WO_STATUS_LABEL: Record<WoStatus, string> = {
  create: "Will Create",
  attach: "Attach To Existing Ticket",
  retire: "Will Retire-Restore",
  fill: "Will Fill",
  addLines: "Will Add Lines",
  removed: "Removed Account",
  unmatched: "Unmatched Account",
  ambiguous: "Ambiguous",
  same: "No Change",
};

/** The history fields a later run may fill when they're blank on the saved row. Account, routing, ticket and date never change. */
export const HISTORY_FILL_FIELDS = [
  { field: "technician", label: "Tech", kind: "text" },
  { field: "original_tech", label: "Done by", kind: "text" },
  { field: "call_category", label: "Call Category", kind: "text", of: (o: WoPlanInput) => o.callCategory },
  { field: "service_type", label: "Service Type", kind: "text", of: (o: WoPlanInput) => o.serviceType },
  { field: "problem", label: "Problem", kind: "text", of: (o: WoPlanInput) => o.problem },
  { field: "work_done", label: "Work Done", kind: "text", of: (o: WoPlanInput) => o.workDone },
  { field: "parts_used", label: "Parts Used", kind: "text", of: (o: WoPlanInput) => o.partsUsed },
  { field: "labor_hours", label: "Labor Hrs", kind: "number", of: (o: WoPlanInput) => o.laborHours },
  { field: "trip_charges", label: "Trip Charges", kind: "number", of: (o: WoPlanInput) => o.tripCharges },
  { field: "parts_amount", label: "Parts $", kind: "number", of: (o: WoPlanInput) => o.partsAmount },
  { field: "invoice_total", label: "Invoice Total", kind: "number", of: (o: WoPlanInput) => o.invoiceTotal },
  { field: "po", label: "PO #", kind: "text", of: (o: WoPlanInput) => o.po },
  { field: "invoice_date", label: "Invoice Date", kind: "date", of: (o: WoPlanInput) => o.invoiceDate },
  { field: "has_items", label: "Has Items", kind: "text", of: (o: WoPlanInput) => o.hasItems },
  { field: "review_flags", label: "Review Flags", kind: "text", of: (o: WoPlanInput) => o.reviewFlags },
] as const;
export type HistoryFillField = (typeof HISTORY_FILL_FIELDS)[number]["field"];

/** The attached ticket's fields a run may fill when blank. Status, WO, account and routing never change. */
export const TICKET_FILL_FIELDS = [
  { field: "technician", label: "Tech", kind: "text" },
  { field: "issue", label: "Issue", kind: "text" },
  { field: "work_done", label: "Work Done", kind: "text" },
  { field: "completed_at", label: "Completed", kind: "date" },
] as const;
export type TicketFillField = (typeof TICKET_FILL_FIELDS)[number]["field"];

export type WoFill = { target: "history" | "ticket"; field: string; label: string; value: string | number; jobId: number | null };

/** A line as compared for missing lines. */
export type KeyLine = Pick<WoLine, "lineType" | "itemCode" | "description" | "qty" | "unitPrice" | "amount" | "invoiceDate">;

/** A history row already saved, as the planner compares it with the file. */
export type SavedHistory = {
  id: number;
  ref: string;
  jobId: number | null;
  /** The account it's saved on. A removed one is restored as Retired when the row is saved again. */
  customer?: string;
  values: Partial<Record<HistoryFillField, string | number | null>>;
  lines: KeyLine[];
};

/** The ticket a saved history row is attached to. */
export type SavedTicket = { id: number; updatedAt: string; technician: string | null; issue: string | null; workDone: string | null; completedAt: string | null };

export type WoPlanLine = {
  ref: string;
  /** The first of `tags`: what the row shows under. */
  status: WoStatus;
  /** Every status that applies: a saved row can be both Will Fill and Will Add Lines. */
  tags: WoStatus[];
  /** The KatzDesk account it goes on (or the removed account's name). */
  account: string | null;
  /** That account's id, when there is one. Will Retire-Restore restores this account. */
  accountId: number | null;
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
  /** The saved history row (Will Fill / Will Add Lines / No Change). */
  historyId: number | null;
  /** Blank fields this row fills: on the saved history row, and on its ticket. */
  fills: WoFill[];
  /** The file's lines the saved row is missing, in file order. */
  newLines: WoLine[];
  addLines: { lines: number; discount: number; invoice: string; discountTotal: number; total: number } | null;
};

/** Saveable rows start ticked except removed accounts. */
export const isSaveable = (s: WoStatus) => s === "create" || s === "attach" || s === "removed" || s === "retire" || s === "fill" || s === "addLines";
export const startsTicked = (s: WoStatus) => s !== "removed" && isSaveable(s);
/** Rows that save a new history work order (the rest change one already saved). */
export const isNewRow = (s: WoStatus) => s === "create" || s === "attach" || s === "removed" || s === "retire";

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

/** Blank in KatzDesk: null, or text that is empty or only spaces. A 0 is a value. */
export const isBlank = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

/** A file value worth filling with: text that isn't blank, any finite number (0 too), a date. */
function fileValue(v: unknown): string | number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") return v.trim() ? v.trim() : null;
  return null;
}

/** "PO #: (blank) → SRV1347", or "Ticket #88 Issue: (blank) → No water". */
export function fillText(f: WoFill): string {
  return `${f.target === "ticket" ? `Ticket #${f.jobId} ` : ""}${f.label}: (blank) → ${f.value}`;
}

/** The blank fields on a saved history row that the file fills. Never a field that has a value. */
export function historyFills(o: WoPlanInput, saved: SavedHistory, activeTechs: string[]): WoFill[] {
  const out: WoFill[] = [];
  const tech = o.tech?.trim() ? historyTech(o.tech, activeTechs) : null;
  for (const d of HISTORY_FILL_FIELDS) {
    if (!isBlank(saved.values[d.field])) continue;
    let v: string | number | null;
    if (d.field === "technician") v = tech?.technician ?? null;
    // The real name goes with the fallback tech, and only when the tech is filled with it.
    else if (d.field === "original_tech") v = tech && isBlank(saved.values.technician) ? tech.originalTech : null;
    else v = fileValue(d.of(o));
    if (v != null) out.push({ target: "history", field: d.field, label: d.label, value: v, jobId: null });
  }
  return out;
}

/** The attached ticket's blank fields the file fills: tech (the roster name), issue, and Work Done and Completed. */
export function ticketFills(o: WoPlanInput, ticket: Pick<SavedTicket, "id" | "technician" | "issue" | "workDone" | "completedAt">, activeTechs: string[], only?: TicketFillField[]): WoFill[] {
  const values: Record<TicketFillField, string | null> = {
    technician: o.tech?.trim() ? historyTech(o.tech, activeTechs).technician : null,
    issue: fileValue(o.problem) as string | null,
    work_done: fileValue(o.workDone) as string | null,
    completed_at: o.completed ? o.completed.slice(0, 10) : null,
  };
  const current: Record<TicketFillField, unknown> = { technician: ticket.technician, issue: ticket.issue, work_done: ticket.workDone, completed_at: ticket.completedAt };
  const out: WoFill[] = [];
  for (const d of TICKET_FILL_FIELDS) {
    if (only && !only.includes(d.field)) continue;
    const v = values[d.field];
    if (v != null && isBlank(current[d.field])) out.push({ target: "ticket", field: d.field, label: d.label, value: v, jobId: ticket.id });
  }
  return out;
}

/**
 * A number rounded to 2 dp as Postgres stores it in numeric(12,2): on its decimal digits, half away from zero (2.135 is
 * 2.14 and -0.125 is -0.13), not on the binary double (where 2.135 is 2.13499…). Keys made this way match saved lines.
 */
export function round2(n: number): number {
  const m = /^(-?)(\d+)(?:\.(\d*))?$/.exec(String(n));
  if (!m) return Math.round(n * 100) / 100;
  const [, sign, int, frac = ""] = m;
  let cents = BigInt(int!) * 100n + BigInt((frac + "00").slice(0, 2));
  if ((frac[2] ?? "0") >= "5") cents += 1n;
  const v = Number(cents) / 100;
  return sign ? -v : v;
}

const keyNum = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "" : String(round2(n)));
const keyText = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

/** The files have no line #: a line is its type, code, description, qty, price, amount and date (2 dp, blank is its own value). */
export function lineKey(l: KeyLine): string {
  return [l.lineType ?? "", keyText(l.itemCode), keyText(l.description), keyNum(l.qty), keyNum(l.unitPrice), keyNum(l.amount), l.invoiceDate ?? ""].join("|");
}

/**
 * The file's lines a saved row doesn't have yet, compared as a multiset: identical lines can repeat, so the file's
 * third copy of a line KatzDesk has twice is one to add. Existing lines are never changed or taken away.
 */
export function missingLines<T extends KeyLine>(existing: KeyLine[], file: T[]): T[] {
  const have = new Map<string, number>();
  for (const l of existing) have.set(lineKey(l), (have.get(lineKey(l)) ?? 0) + 1);
  const out: T[] = [];
  for (const l of file) {
    const k = lineKey(l);
    const n = have.get(k) ?? 0;
    if (n > 0) have.set(k, n - 1);
    else out.push(l);
  }
  return out;
}

const SAME_REASON = "Already saved; nothing blank to fill and no missing lines.";

/**
 * Plan every row against KatzDesk as it is now. Saves nothing.
 * `savedRefs`: History Refs already imported. `saved`: those rows as saved (by lowercase ref), so blanks can be filled
 * and missing lines added; a saved ref without one is No Change. `linkedJobs`: tickets already holding a history row.
 * A saved row is matched on History Ref only, never on the WO # alone (a reused WO # on another date is another job).
 */
export function planWoHistory(
  orders: WoPlanInput[],
  ctx: {
    accounts: PlanAccount[];
    activeTechs: string[];
    savedRefs: Set<string>;
    tickets: PlanTicket[];
    linkedJobs: Set<number>;
    saved?: Map<string, SavedHistory>;
    savedTickets?: Map<number, SavedTicket>;
  },
  fileLines: WoLine[] = [],
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
  const linesByRef = new Map<string, WoLine[]>();
  for (const l of fileLines) linesByRef.set(l.ref.toLowerCase(), [...(linesByRef.get(l.ref.toLowerCase()) ?? []), l]);
  const claimed = new Set(ctx.linkedJobs);
  const saved = new Set([...ctx.savedRefs].map((r) => r.toLowerCase()));
  return orders.map((o): WoPlanLine => {
    const locationNeeded = o.locationSource.trim().toLowerCase() === "missing" || !o.serviceLocation.trim();
    const lookup = (locationNeeded ? o.customer : o.serviceLocation).trim();
    const tech = historyTech(o.tech, ctx.activeTechs);
    const base = { ref: o.ref, lookup, locationNeeded, jobId: null, seen: null, ...tech, reason: null, accountId: null, historyId: null, fills: [] as WoFill[], newLines: [] as WoLine[], addLines: null };
    const one = (status: WoStatus, rest: Partial<WoPlanLine>): WoPlanLine => ({ ...base, account: null, ...rest, status, tags: [status] });
    const ref = o.ref.toLowerCase();
    const row = ctx.saved?.get(ref);
    if (row) return savedLine(o, row, base);
    if (saved.has(ref)) return one("same", { account: lookup, reason: SAME_REASON });
    const live = active.get(nameKey(lookup)) ?? [];
    if (!live.length) {
      const gone = removed.get(nameKey(lookup)) ?? [];
      if (gone.length > 1)
        return one("ambiguous", { account: null, reason: `${gone.length} removed accounts are named “${lookup}”. Keep one on Customers, then read the files again.` });
      if (gone.length === 1) {
        const g = gone[0]!;
        // A parent account (Walk - In, Cimbali National Accounts) is never brought back to hold Location Needed rows.
        if (locationNeeded)
          return one("removed", { account: g.name, accountId: g.id, reason: `“${g.name}” was removed from Customers, and a parent account isn't restored for Location Needed rows. Ticked, it saves on the removed account without restoring it.` });
        return one("retire", {
          account: g.name,
          accountId: g.id,
          reason: `“${g.name}” was removed from Customers. Saving restores it as Retired: hidden from pickers and lists, and it takes no new tickets, installs or PMs.`,
        });
      }
      return one("unmatched", {
        reason: locationNeeded ? `No account named “${lookup}” for the Location Needed rows.` : `No account named “${lookup}”. Fix the name on Clean Names, then read the files again.`,
      });
    }
    const acct = live[0]!;
    const account = acct.name;
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
      return one("ambiguous", { account, accountId: acct.id, reason: `${hits.length} KatzDesk tickets have ${o.wo} on this account within ${ATTACH_WINDOW_DAYS} days: #${hits.map((t) => t.id).join(", #")}.` });
    if (hits.length === 1) {
      const t = hits[0]!;
      if (claimed.has(t.id)) return one("ambiguous", { account, accountId: acct.id, reason: `Ticket #${t.id} (${o.wo}) already has another history row.` });
      claimed.add(t.id);
      // Work Done and Completed fill as they always have; the ticket's blank tech and issue fill too.
      const fills = ticketFills(o, { id: t.id, technician: t.technician ?? null, issue: t.issue ?? null, workDone: t.workDone, completedAt: t.completedAt }, ctx.activeTechs, ["technician", "issue"]);
      return one("attach", {
        account,
        accountId: acct.id,
        jobId: t.id,
        seen: t.updatedAt,
        fills,
        reason: `KatzDesk ticket #${t.id} (${t.wo}, received ${t.received}).${fills.length ? ` Fills ${fills.map(fillText).join("; ")}.` : ""}`,
      });
    }
    return one("create", { account, accountId: acct.id, reason: acct.inactive ? `On “${account}”, which is Retired.` : null });
  });

  function savedLine(o: WoPlanInput, row: SavedHistory, base: Omit<WoPlanLine, "status" | "tags" | "account">): WoPlanLine {
    const fills = historyFills(o, row, ctx.activeTechs);
    const ticket = row.jobId != null ? ctx.savedTickets?.get(row.jobId) : undefined;
    if (ticket) fills.push(...ticketFills(o, ticket, ctx.activeTechs));
    const fileOwn = linesByRef.get(o.ref.toLowerCase()) ?? [];
    const newLines = missingLines(row.lines, fileOwn);
    const tags: WoStatus[] = [];
    // Saved on an account that was removed (and no active account has the name): saving again restores it as Retired.
    const onRemoved = row.customer && !(active.get(nameKey(row.customer)) ?? []).length ? (removed.get(nameKey(row.customer)) ?? []) : [];
    const retire = onRemoved.length === 1 && !base.locationNeeded ? onRemoved[0]! : null;
    if (retire) tags.push("retire");
    if (fills.length) tags.push("fill");
    if (newLines.length) tags.push("addLines");
    if (!tags.length) tags.push("same");
    let addLines: WoPlanLine["addLines"] = null;
    if (newLines.length) {
      const inv = historyInvoice([...row.lines, ...newLines]);
      const discount = newLines.filter((l) => LINE_KIND[l.lineType] === "discount").length;
      addLines = { lines: newLines.length, discount, invoice: `Invoice ${o.wo || o.ref}`, discountTotal: inv.discount, total: inv.total };
    }
    const reasons = [
      ...(retire ? [`Saved on “${retire.name}”, which was removed. Saving restores it as Retired: hidden from pickers and lists, and it takes no new tickets, installs or PMs.`] : []),
      ...(fills.length ? [fills.map(fillText).join("; ")] : []),
      ...(addLines ? [`${addLines.lines} ${addLines.lines === 1 ? "line" : "lines"} (${addLines.discount} discount) to ${addLines.invoice}`] : []),
    ];
    return {
      ...base,
      account: retire?.name ?? row.customer ?? base.lookup,
      accountId: retire?.id ?? null,
      status: tags[0]!,
      tags,
      historyId: row.id,
      jobId: row.jobId,
      seen: ticket && fills.some((f) => f.target === "ticket") ? ticket.updatedAt : null,
      fills,
      newLines,
      addLines,
      reason: reasons.length ? reasons.join(" · ") : SAME_REASON,
    };
  }
}

export type WoCounts = Record<WoStatus, number> & { locationNeeded: number; remapped: number };

/** Every status a row has counts once: a row that fills and adds lines counts in both. */
export function countWoPlan(lines: WoPlanLine[]): WoCounts {
  const c: WoCounts = { create: 0, attach: 0, retire: 0, fill: 0, addLines: 0, removed: 0, unmatched: 0, ambiguous: 0, same: 0, locationNeeded: 0, remapped: 0 };
  for (const l of lines) {
    for (const t of l.tags ?? [l.status]) c[t]++;
    if (l.locationNeeded && l.historyId == null && isNewRow(l.status)) c.locationNeeded++;
    if (l.originalTech && l.historyId == null && isNewRow(l.status)) c.remapped++;
  }
  return c;
}

/** Will Retire-Restore, by account: "Test Cafe - North: 18 WOs". */
export function retireByAccount(lines: WoPlanLine[]): { account: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of lines) if (l.status === "retire" && l.account) m.set(l.account, (m.get(l.account) ?? 0) + 1);
  return [...m].map(([account, count]) => ({ account, count })).sort((a, b) => b.count - a.count || a.account.localeCompare(b.account));
}

/** Tickets that go to the fallback tech, by the tech who did them. */
export function remappedByTech(lines: WoPlanLine[]): { tech: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of lines) if (l.originalTech && l.historyId == null && isNewRow(l.status)) m.set(l.originalTech, (m.get(l.originalTech) ?? 0) + 1);
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

/**
 * The invoice the lines make: Amount as billed (never qty × price), Discount lines summed into one discount.
 * These work orders come from the legacy QuickBooks system, where the QuickBooks invoice # IS the Corrigo WO #: a
 * history invoice is "Invoice WO-####", one per History Ref, dated by its earliest line.
 */
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

// ── Line costs (Jesus, 11/24) ────────────────────────────────────────────────────────────────────────────────────────
//
// QuickBooks purchase cost on history lines, from one CSV (Tickets → Import → Update History Line Costs). A file row
// is keyed by History Ref + Line Sort (the line's 0-based position among that ref's rows in the Items file, Discount
// lines counted), and that key is verified, never trusted: it matches only when exactly one saved line has that sort
// and the same line type, item code (any case and spacing), qty and amount (to the cent). Anything else is a
// Mismatch and is never written. Only blank cost is ever filled; a different cost is shown, never overwritten.

export const LINE_COST_COLUMNS = {
  ref: "History Ref",
  sort: "Line Sort",
  lineType: "Line Type",
  itemCode: "Item Code",
  qty: "Qty",
  unitPrice: "Unit Price",
  amount: "Amount",
  unitCost: "Unit Cost",
  lineCost: "Line Cost",
  costBasis: "Cost Basis",
  costDate: "Cost Date",
  costSource: "Cost Source",
  costFlag: "Cost Flag",
} as const;
const LINE_COST_REQUIRED: (keyof typeof LINE_COST_COLUMNS)[] = [
  "ref",
  "sort",
  "lineType",
  "itemCode",
  "qty",
  "unitPrice",
  "amount",
  "unitCost",
  "lineCost",
  "costBasis",
  "costDate",
  "costSource",
];

/** How a cost was found: the last purchase on or before the invoice (the default), else flagged. */
export const COST_BASES = ["last_on_or_before", "first_after", "wtd_avg"] as const;
export type CostBasis = (typeof COST_BASES)[number];
export const COST_BASIS_LABEL: Record<CostBasis, string> = {
  last_on_or_before: "Last purchase on or before the invoice",
  first_after: "First purchase after the invoice",
  wtd_avg: "Weighted average",
};
/** Line types that never take a cost: this data has no labor or trip cost, and a discount isn't an item. */
export const NO_COST_LINE_TYPES = ["Discount", "Labor", "Trip Charge"] as const;

export type LineCostRow = {
  /** The file's own line number (the header is line 1). */
  line: number;
  ref: string;
  sort: number;
  lineType: string;
  itemCode: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
  unitCost: number;
  lineCost: number;
  costBasis: CostBasis;
  costDate: string | null;
  costSource: string;
  costFlag: string | null;
};

export type LineCostRead = { rows: LineCostRow[]; problems: string[] };

const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10_000) / 10_000;

/** A YYYY-MM-DD that is a real calendar day (not 2025-02-30). */
export function isRealDay(d: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return false;
  const t = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return t.getUTCFullYear() === Number(m[1]) && t.getUTCMonth() === Number(m[2]) - 1 && t.getUTCDate() === Number(m[3]);
}

/** Line Cost is Qty × Unit Cost (a blank Qty bills one), within a cent. */
export const lineCostAddsUp = (qty: number | null, unitCost: number, lineCost: number) => Math.abs(round2((qty ?? 1) * unitCost) - lineCost) <= 0.01 + 1e-9;
export const isNoCostLineType = (t: string) => (NO_COST_LINE_TYPES as readonly string[]).some((x) => x.toLowerCase() === t.trim().toLowerCase());

/** Read and check the line-cost file. Any problem stops the import: nothing is previewed or saved. */
export function readHistoryLineCosts(text: string): LineCostRead {
  const problems: string[] = [];
  const problem = (p: string) => {
    if (problems.length < MAX_PROBLEMS) problems.push(p);
  };
  const all = parseCsv(text);
  if (!all.length) return { rows: [], problems: ["The file is empty."] };
  const idx = headerIndex(all[0]!, LINE_COST_COLUMNS);
  const missing = LINE_COST_REQUIRED.filter((k) => idx[k] < 0).map((k) => LINE_COST_COLUMNS[k]);
  if (missing.length) return { rows: [], problems: [`The file has no ${missing.map((c) => `“${c}”`).join(", ")} column.`] };
  const rows: LineCostRow[] = [];
  const seen = new Map<string, number>();
  all.slice(1).forEach((cells, n) => {
    const line = n + 2;
    const c = (k: keyof typeof LINE_COST_COLUMNS) => (idx[k] >= 0 ? String(cells[idx[k]] ?? "").trim() : "");
    if (cells.every((x) => !String(x ?? "").trim())) return;
    const ref = c("ref");
    if (!ref) return problem(`Line ${line}: no History Ref.`);
    const where = `Line ${line} (${ref})`;
    const sortRaw = c("sort");
    const sort = /^\d+$/.test(sortRaw) ? Number(sortRaw) : Number.NaN;
    if (!Number.isInteger(sort)) return problem(`${where}: Line Sort “${sortRaw}” isn't a whole number.`);
    const key = `${ref.toLowerCase()}#${sort}`;
    if (seen.has(key)) return problem(`${where}: Line Sort ${sort} is also on line ${seen.get(key)}.`);
    seen.set(key, line);
    const lineType = c("lineType");
    if (isNoCostLineType(lineType))
      return problem(`${where}: a ${lineType} line doesn't take a cost; only part, filter and other item lines do.`);
    const numberOf = (k: "qty" | "unitPrice" | "amount" | "unitCost" | "lineCost") => {
      const v = readNumber(c(k));
      if (Number.isNaN(v)) problem(`${where}: ${LINE_COST_COLUMNS[k]} “${c(k)}” isn't a number.`);
      return v;
    };
    const qty = numberOf("qty");
    const unitPrice = numberOf("unitPrice");
    const amount = numberOf("amount");
    const unitCost = numberOf("unitCost");
    const lineCost = numberOf("lineCost");
    if ([qty, unitPrice, amount, unitCost, lineCost].some((v) => Number.isNaN(v))) return;
    if (unitCost == null) return problem(`${where}: no Unit Cost.`);
    if (unitCost < 0) return problem(`${where}: Unit Cost ${unitCost} is below zero.`);
    if (lineCost == null) return problem(`${where}: no Line Cost.`);
    // A blank Qty bills one, as QuickBooks reads it.
    const expect = round2((qty ?? 1) * unitCost);
    if (Math.abs(expect - lineCost) > 0.01 + 1e-9)
      return problem(`${where}: Line Cost ${lineCost} isn't Qty × Unit Cost (${qty ?? 1} × ${unitCost} = ${expect}).`);
    const basis = c("costBasis").toLowerCase();
    if (!(COST_BASES as readonly string[]).includes(basis))
      return problem(`${where}: Cost Basis “${c("costBasis")}” isn't one of ${COST_BASES.join(", ")}.`);
    const costDate = readDay(c("costDate"));
    if (costDate === undefined || (c("costDate") && !isRealDay(c("costDate"))))
      return problem(`${where}: Cost Date “${c("costDate")}” isn't YYYY-MM-DD.`);
    const costSource = c("costSource").toLowerCase();
    if (costSource !== "quickbooks") return problem(`${where}: Cost Source “${c("costSource")}” isn't quickbooks.`);
    rows.push({
      line,
      ref,
      sort,
      lineType,
      itemCode: c("itemCode"),
      qty,
      unitPrice,
      amount,
      unitCost: round4(unitCost),
      lineCost: round2(lineCost),
      costBasis: basis as CostBasis,
      costDate: costDate ?? null,
      costSource,
      costFlag: c("costFlag") || null,
    });
  });
  return { rows, problems };
}

/** A saved history line, as the planner and the save compare it. */
export type SavedCostLine = {
  id: number;
  sort: number;
  lineType: string;
  itemCode: string | null;
  qty: number | null;
  amount: number | null;
  unitCost: number | null;
  lineCost: number | null;
  costBasis: string | null;
  costDate: string | null;
  costSource: string | null;
  costFlag: string | null;
};

/** A saved history work order: its account is removed, and its lines. */
export type SavedCostOrder = { historyId: number; customer: string; removed: boolean; lines: SavedCostLine[] };

export type LineCostStatus = "fill" | "same" | "different" | "mismatch" | "noHistory" | "removed";
export const LINE_COST_STATUSES: LineCostStatus[] = ["fill", "same", "different", "mismatch", "noHistory", "removed"];
export const LINE_COST_STATUS_LABEL: Record<LineCostStatus, string> = {
  fill: "Will Fill Cost",
  same: "No Change",
  different: "Has Different Cost",
  mismatch: "Mismatch",
  noHistory: "No History WO",
  removed: "Removed Account",
};
/** Only Will Fill starts ticked; Removed Account can be ticked by hand. Nothing else is ever written. */
export const lineCostSaveable = (s: LineCostStatus) => s === "fill" || s === "removed";
export const lineCostStartsTicked = (s: LineCostStatus) => s === "fill";

export type LineCostPlanLine = {
  row: LineCostRow;
  status: LineCostStatus;
  lineId: number | null;
  historyId: number | null;
  customer: string | null;
  /** What differs (Mismatch), or the cost already saved (Has Different Cost). */
  reason: string | null;
  saved: Pick<SavedCostLine, "unitCost" | "lineCost" | "costBasis" | "costDate" | "costSource" | "costFlag"> | null;
};

/** Item codes as compared: any case, no spaces. */
export const itemCodeKey = (s: string | null | undefined) => String(s ?? "").replace(/\s+/g, "").toLowerCase();
const sameCents = (a: number | null, b: number | null) => (a == null || b == null ? a == null && b == null : Math.abs(round2(a) - round2(b)) < 0.005);
const sameCost = (a: number | null, b: number | null) => (a == null || b == null ? a == null && b == null : Math.abs(round4(a) - round4(b)) < 0.00005);
const hasAnyCost = (l: SavedCostLine) => l.unitCost != null || l.lineCost != null || !!l.costBasis || !!l.costDate || !!l.costSource || !!l.costFlag;

/** The plan for each file row against what's saved (keyed by History Ref, any case). Pure. */
export function planLineCosts(rows: LineCostRow[], saved: Map<string, SavedCostOrder>): LineCostPlanLine[] {
  return rows.map((row) => {
    const order = saved.get(row.ref.toLowerCase());
    const base = { row, lineId: null, historyId: order?.historyId ?? null, customer: order?.customer ?? null, reason: null, saved: null };
    if (!order) return { ...base, status: "noHistory" as const, reason: "This History Ref isn't saved in KatzDesk." };
    const at = order.lines.filter((l) => l.sort === row.sort);
    if (at.length !== 1)
      return { ...base, status: "mismatch" as const, reason: at.length ? `${at.length} saved lines have Line Sort ${row.sort}.` : `No saved line has Line Sort ${row.sort}.` };
    const l = at[0]!;
    const diffs: string[] = [];
    if (l.lineType.toLowerCase() !== row.lineType.toLowerCase()) diffs.push(`line type is ${l.lineType}, the file says ${row.lineType}`);
    if (itemCodeKey(l.itemCode) !== itemCodeKey(row.itemCode)) diffs.push(`item is ${l.itemCode || "(blank)"}, the file says ${row.itemCode || "(blank)"}`);
    if (!sameCents(l.qty, row.qty)) diffs.push(`qty is ${l.qty ?? "(blank)"}, the file says ${row.qty ?? "(blank)"}`);
    if (!sameCents(l.amount, row.amount)) diffs.push(`amount is ${l.amount ?? "(blank)"}, the file says ${row.amount ?? "(blank)"}`);
    const savedCost = { unitCost: l.unitCost, lineCost: l.lineCost, costBasis: l.costBasis, costDate: l.costDate, costSource: l.costSource, costFlag: l.costFlag };
    const matched = { ...base, lineId: l.id };
    if (diffs.length) return { ...matched, lineId: null, status: "mismatch" as const, reason: `At Line Sort ${row.sort} the ${diffs.join("; ")}.` };
    if (hasAnyCost(l)) {
      const same =
        sameCost(l.unitCost, row.unitCost) &&
        sameCents(l.lineCost, row.lineCost) &&
        (l.costBasis ?? "") === row.costBasis &&
        (l.costDate ?? "") === (row.costDate ?? "") &&
        (l.costSource ?? "") === row.costSource &&
        (l.costFlag ?? "") === (row.costFlag ?? "");
      return { ...matched, status: same ? ("same" as const) : ("different" as const), saved: savedCost };
    }
    if (order.removed) return { ...matched, status: "removed" as const, reason: `${order.customer} is a removed account.` };
    return { ...matched, status: "fill" as const };
  });
}

export type LineCostCounts = Record<LineCostStatus, number> & {
  /** What Will Fill would add: the lines' billed amount, their cost, and amount − cost. */
  fillSell: number;
  fillCost: number;
  fillProfit: number;
};

export function countLineCostPlan(plan: LineCostPlanLine[]): LineCostCounts {
  const out = { fill: 0, same: 0, different: 0, mismatch: 0, noHistory: 0, removed: 0, fillSell: 0, fillCost: 0, fillProfit: 0 };
  for (const p of plan) {
    out[p.status] += 1;
    if (p.status === "fill") {
      out.fillSell += p.row.amount ?? 0;
      out.fillCost += p.row.lineCost;
    }
  }
  out.fillSell = round2(out.fillSell);
  out.fillCost = round2(out.fillCost);
  out.fillProfit = round2(out.fillSell - out.fillCost);
  return out;
}

/** Lines and the cost text they're saved with, in batches of up to `size` for the save. */
export function lineCostBatches<T>(items: T[], size = 1000): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ── History profit (Jesus, 11/24) ────────────────────────────────────────────────────────────────────────────────────
//
// Parts cost only: labor, trip, service and install lines have no cost in this data, and today's Labor Cost Rate is
// never applied. Profit is counted after the invoice's discount. Katz Coffee Service Dept. is left out of every profit
// total (shown with its cost, never a profit).

export const HISTORY_COST_NOTE = "Parts cost only; labor cost not included";

export type CostedLine = { kind: string; amount: number | null; lineCost: number | null };

/** Lines that are bought, so a missing cost is work left to do: they always count in "N of M lines costed". */
export const ALWAYS_COSTED_KINDS = ["part", "filter", "equipment"] as const;

/**
 * Whether a line counts toward "N of M lines costed" and Uncosted Sell (Jesus, 11/24, choice C): parts, filters and
 * equipment always; install fees, service and other charges only once they hold a cost (they're usually our own work,
 * with a cost only when something like a subcontractor bill backs them); labor, trip and discounts never.
 */
export const countsAsCostable = (kind: string, lineCost: number | null) =>
  (ALWAYS_COSTED_KINDS as readonly string[]).includes(kind) || (kind !== "discount" && !isHistoryLabor(kind) && lineCost != null);

/**
 * An invoice's known cost, how many of the lines that count (countsAsCostable) have one, whether any is missing, its
 * profit after the discount (every line's sell, less the discount, less the cost: only when none is missing), and the
 * sell of the counted lines with no cost yet.
 */
export function historyInvoiceCost(
  lines: CostedLine[],
  discount: number,
): { cost: number; costedLines: number; totalLines: number; subtotal: number; partial: boolean; profit: number | null; uncostedSell: number } {
  const items = lines.filter((l) => l.kind !== "discount");
  const subtotal = round2(items.reduce((s, l) => s + (l.amount ?? 0), 0));
  const costable = items.filter((l) => countsAsCostable(l.kind, l.lineCost));
  const costed = costable.filter((l) => l.lineCost != null);
  const cost = round2(costed.reduce((s, l) => s + (l.lineCost ?? 0), 0));
  const uncostedSell = round2(costable.filter((l) => l.lineCost == null).reduce((s, l) => s + (l.amount ?? 0), 0));
  // The Profit report's rule (groupTotals, billProfitTotals): an invoice has a profit only when every line that needs a
  // cost has one, so a part with no cost never counts its whole sell as profit (Jesus, 11/24). Labor and trip only is
  // fully costed, at cost 0.
  const partial = costed.length < costable.length;
  return { cost, costedLines: costed.length, totalLines: costable.length, subtotal, partial, profit: partial ? null : round2(subtotal - discount - cost), uncostedSell };
}
