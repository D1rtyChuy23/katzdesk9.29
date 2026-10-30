/**
 * Billing Backfill (Grok's billing request through Chuy, 2026-10-28): NetSuite's charges, Sales Orders and invoices
 * brought back onto KatzDesk tickets, keyed by WO. Admin only, preview first.
 *
 * Files (CSV or Excel, either or both, columns read by header name):
 * - charges: WO, Source invoice #, Source SO #, NetSuite customer, Location, Item, Item type, Description, Qty, Rate,
 *   Amount, Discount Item, Discount Amount, Record total (after discount). The lines of one NetSuite record per WO.
 * - invoices: WO, SO #, SO status, Invoice #, Invoice date, Invoice status, Invoice total, Amount remaining,
 *   Charges source, Corrigo net (reference). One row per invoice (Voided ones too), and Sales Orders with no invoice yet.
 *
 * Per ticket:
 * - not locked (no live invoice in KatzDesk yet): charges first (credit lines netted by item, the discount as the
 *   header discount in dollars), then the Sales Order and its billed date, then the invoices;
 * - locked (an invoice that isn't Voided is already on it): only invoice records (number, status, total, remaining).
 *   Charges, P.O., discount, Sales Order and billed date are never touched;
 * - skipped: no ticket with the WO, a merged (duplicate) ticket, the WO only on PMs or Installs, a WO on two tickets
 *   that can't be told apart, or a ticket on Walk-In (never a billing account).
 *
 * Pure: no server imports, safe for node --test.
 */
import { chargesTotal, kindForItem, round2, type ChargeKind } from "./charges.ts";
import { applyDiscount, type Discount } from "./discount.ts";
import {
  discountFromNetSuite,
  isDiscountItem,
  isVoidedStatus,
  liveInvoiceTotal,
  locationWarning,
  noInvoiceYet,
  possibleDoubleBill,
} from "./billing-rules.ts";
import { isWalkIn } from "./customer-key.ts";
import { leafOf } from "./clean-names.ts";
import { parseCompletedDate, woCanonical, woMatchKey } from "./corrigo.ts";
import { nameKey } from "./wo-history.ts";

// ── Reading the files ────────────────────────────────────────────────────────────────────────────────────────────────

type Field =
  | "wo"
  | "sourceInvoice"
  | "sourceSo"
  | "nsCustomer"
  | "location"
  | "item"
  | "itemType"
  | "description"
  | "qty"
  | "rate"
  | "amount"
  | "discountItem"
  | "discountAmount"
  | "recordTotal"
  | "so"
  | "soStatus"
  | "invoice"
  | "invoiceDate"
  | "invoiceStatus"
  | "invoiceTotal"
  | "remaining"
  | "chargesSource"
  | "corrigoNet";

const ALIASES: Record<Field, string[]> = {
  wo: ["wo", "st", "work order", "wo number"],
  sourceInvoice: ["source invoice", "source invoice number"],
  sourceSo: ["source so", "source so number", "source sales order"],
  nsCustomer: ["netsuite customer", "customer"],
  location: ["location"],
  item: ["item"],
  itemType: ["item type", "line type"],
  description: ["description"],
  qty: ["qty", "quantity"],
  rate: ["rate"],
  amount: ["amount"],
  discountItem: ["discount item"],
  discountAmount: ["discount amount", "discount rate", "discount"],
  recordTotal: ["record total after discount", "record total"],
  so: ["so", "so number", "sales order"],
  soStatus: ["so status", "sales order status"],
  invoice: ["invoice", "invoice number"],
  invoiceDate: ["invoice date"],
  invoiceStatus: ["invoice status"],
  invoiceTotal: ["invoice total", "netsuite amount", "invoice amount"],
  remaining: ["amount remaining", "amount due", "balance"],
  chargesSource: ["charges source"],
  corrigoNet: ["corrigo net reference", "corrigo net"],
};

/** "Record total (after discount)" → "record total after discount"; "Invoice #" → "invoice". */
export function headerKey(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/#/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_HEADER = new Map<string, Field>(Object.entries(ALIASES).flatMap(([f, keys]) => keys.map((k) => [k, f as Field] as const)));

export type BackfillLine = {
  file: string;
  line: number;
  wo: string;
  key: string;
  item: string;
  itemType: string;
  description: string;
  qty: number;
  rate: number;
  amount: number;
  discountItem: string;
  discountAmount: number | null;
  recordTotal: number | null;
  sourceInvoice: string;
  sourceSo: string;
  location: string;
  nsCustomer: string;
};

export type BackfillInvoiceRow = {
  file: string;
  line: number;
  wo: string;
  key: string;
  so: string;
  soStatus: string;
  invoice: string;
  date: string | null;
  status: string;
  total: number | null;
  remaining: number | null;
  chargesSource: boolean;
  corrigoNet: number | null;
};

export type BackfillRead = {
  lines: BackfillLine[];
  invoices: BackfillInvoiceRow[];
  /** Rows with no WO, or nothing to read. */
  skipped: number;
  /** What each file and sheet was read as. */
  sheets: { file: string; sheet: string; kind: "charges" | "invoices" | "both"; rows: number }[];
  /** Sheets with no WO column. */
  ignored: string[];
};

/** "$1,234.50", "-307.2" and "(5.00)" are numbers; blanks are null. */
export function moneyCell(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw ?? "").trim().replace(/[$,\s]/g, "");
  if (!s) return null;
  if (/^\(.*\)$/.test(s)) s = `-${s.slice(1, -1)}`;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const cellText = (v: unknown) => String(v ?? "").trim();

/** Every sheet of every file that has a WO column: its charge lines and its invoice rows. */
export function readBackfillSheets(files: { file: string; sheets: { name: string; matrix: unknown[][] }[] }[]): BackfillRead {
  const out: BackfillRead = { lines: [], invoices: [], skipped: 0, sheets: [], ignored: [] };
  for (const f of files) {
    for (const sheet of f.sheets) {
      const at = sheet.matrix.slice(0, 10).findIndex((row) => (row ?? []).some((c) => BY_HEADER.get(headerKey(c)) === "wo"));
      if (at < 0) {
        out.ignored.push(`${f.file}${f.sheets.length > 1 ? ` (${sheet.name})` : ""}`);
        continue;
      }
      const cols = new Map<Field, number>();
      (sheet.matrix[at] ?? []).forEach((c, i) => {
        const field = BY_HEADER.get(headerKey(c));
        if (field && !cols.has(field)) cols.set(field, i);
      });
      const hasLines = cols.has("item") && (cols.has("amount") || cols.has("rate"));
      const hasInvoices = cols.has("invoice") || cols.has("so");
      if (!hasLines && !hasInvoices) {
        out.ignored.push(`${f.file}${f.sheets.length > 1 ? ` (${sheet.name})` : ""}`);
        continue;
      }
      let rows = 0;
      for (let i = at + 1; i < sheet.matrix.length; i++) {
        const row = sheet.matrix[i] ?? [];
        if (row.every((c) => !cellText(c))) continue;
        const get = (field: Field) => (cols.has(field) ? row[cols.get(field)!] : undefined);
        const wo = cellText(get("wo"));
        const key = woMatchKey(wo);
        if (!/^\d+$/.test(key)) {
          out.skipped += 1;
          continue;
        }
        rows += 1;
        const base = { file: f.file, line: i + 1, wo: woCanonical(wo), key };
        const item = cellText(get("item"));
        if (hasLines && item) {
          const qty = moneyCell(get("qty"));
          const rate = moneyCell(get("rate"));
          const amount = moneyCell(get("amount"));
          out.lines.push({
            ...base,
            item,
            itemType: cellText(get("itemType")),
            description: cellText(get("description")),
            qty: qty ?? 1,
            rate: rate ?? 0,
            amount: amount ?? round2((qty ?? 1) * (rate ?? 0)),
            discountItem: cellText(get("discountItem")),
            discountAmount: moneyCell(get("discountAmount")),
            recordTotal: moneyCell(get("recordTotal")),
            sourceInvoice: cellText(get("sourceInvoice")),
            sourceSo: cellText(get("sourceSo")),
            location: cellText(get("location")),
            nsCustomer: cellText(get("nsCustomer")),
          });
        }
        if (hasInvoices) {
          const invoice = cellText(get("invoice"));
          const so = cellText(get("so")).toUpperCase().replace(/\s+/g, "");
          if (invoice || so) {
            const source = cellText(get("chargesSource")).toLowerCase();
            out.invoices.push({
              ...base,
              so,
              soStatus: cellText(get("soStatus")),
              invoice: noInvoiceYet(invoice, cellText(get("invoiceStatus"))) ? "" : invoice.toUpperCase().replace(/\s+/g, ""),
              date: parseCompletedDate(cellText(get("invoiceDate"))),
              status: cellText(get("invoiceStatus")),
              total: moneyCell(get("invoiceTotal")),
              remaining: moneyCell(get("remaining")),
              chargesSource: source === "yes" || source === "y" || source === "true" || source === "1",
              corrigoNet: moneyCell(get("corrigoNet")),
            });
          }
        }
      }
      out.sheets.push({ file: f.file, sheet: sheet.name, kind: hasLines && hasInvoices ? "both" : hasLines ? "charges" : "invoices", rows });
    }
  }
  return out;
}

// ── Planning ─────────────────────────────────────────────────────────────────────────────────────────────────────────

export type BackfillChargeLine = { item: string; description: string; qty: number; rate: number; kind: ChargeKind };

/** A KatzDesk ticket as the plan needs it. */
export type BackfillTicket = {
  id: number;
  kind: "service" | "tlc";
  wo: string | null;
  customer: string | null;
  technician: string | null;
  duplicateOf: number | null;
  /** Merged into an install (10/30): its duplicateOf is its own id. */
  mergedInstallId?: number | null;
  /**
   * Merged into an install as billed (10/30): what on, its Sales Order or with none "NetSuite invoice …". Its billing is
   * still its own, so its NetSuite invoices are recorded here, and nothing else (its charges and Sales Order stay as
   * they were merged).
   */
  billedOnInstall?: string | null;
  /** That Sales Order; null when it was merged as billed on NetSuite invoices alone (or not as billed). */
  billedSoOnInstall?: string | null;
  /** YYYY-MM-DD */
  received: string | null;
  completed: string | null;
  so: string | null;
  /** The billed date as YYYY-MM-DD (Chicago). */
  billedOn: string | null;
  discount: Discount | null;
  corrigoNet: number | null;
  /** updated_at as text: the write skips a ticket that changed after the plan. */
  seen: string;
  lines: { item: string; description: string; qty: number; rate: number }[];
  invoices: { invoice: string; so: string | null; date: string | null; status: string; total: number | null; remaining: number | null; location: string | null }[];
};

export type BackfillStatus = "write" | "invoices" | "same" | "skip";

export const BACKFILL_STATUS_LABEL: Record<BackfillStatus, string> = {
  write: "Will Write",
  invoices: "Invoices Only (Locked)",
  same: "No Change",
  skip: "Skipped",
};

export type BackfillInvoicePlan = {
  invoice: string;
  so: string | null;
  date: string | null;
  status: string;
  total: number | null;
  remaining: number | null;
  location: string | null;
  source: "so" | "standalone";
  change: "new" | "updated" | "same";
  before: { status: string; total: number | null; remaining: number | null } | null;
};

export type BackfillPlan = {
  key: string;
  wo: string;
  status: BackfillStatus;
  reason: string | null;
  jobId: number | null;
  kind: "service" | "tlc" | null;
  customer: string | null;
  technician: string | null;
  seen: string | null;
  /** Already invoiced in KatzDesk: only invoice records are written. */
  locked: boolean;
  charges: {
    current: BackfillChargeLine[];
    next: BackfillChargeLine[] | null;
    currentNet: number;
    nextNet: number | null;
    currentOff: number;
    nextDiscount: Discount | null;
    /** The file's charges differ from the ticket's (lines or discount). */
    change: boolean;
    note: string | null;
  };
  so: { current: string | null; next: string | null; billedOn: string | null; change: boolean; note: string | null };
  invoices: BackfillInvoicePlan[];
  amounts: { kd: number; netsuite: number; corrigo: number | null; doubleBill: boolean; nsMismatch: boolean; corrigoMismatch: boolean };
  warnings: string[];
};

export type BackfillContext = {
  tickets: BackfillTicket[];
  /** WO match keys on the PM and Install boards. */
  otherBoards: Map<string, ("pm" | "install")[]>;
};

const CENT = 0.005;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${a}T12:00:00Z`) - Date.parse(`${b}T12:00:00Z`)) / 86_400_000);

/** Line items that are never charges: subtotals and description-only rows. */
const NOT_A_LINE = /^(subtotal|description|markup|group|endgroup)$/i;

/**
 * NetSuite's lines as KatzDesk charges. Credit lines (negative quantity) are netted against the same item, so the
 * charges add up to what NetSuite billed; an item that nets to nothing is dropped. A line whose amount isn't its
 * quantity times its rate takes amount ÷ quantity as its rate; a half cent left over is split across two lines.
 */
export function chargeLinesFromNetSuite(rows: Pick<BackfillLine, "item" | "itemType" | "description" | "qty" | "rate" | "amount">[]): {
  lines: BackfillChargeLine[];
  problem: string | null;
} {
  type Group = { item: string; description: string; parts: { qty: number; amount: number }[] };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    if (NOT_A_LINE.test(r.itemType) || isDiscountItem(r.item, r.itemType)) continue;
    const k = r.item.trim().toLowerCase();
    const g = groups.get(k) ?? { item: r.item.trim(), description: "", parts: [] };
    if (!g.description && r.description && r.qty > 0) g.description = r.description;
    g.parts.push({ qty: r.qty, amount: r.amount });
    groups.set(k, g);
  }
  const lines: BackfillChargeLine[] = [];
  for (const g of groups.values()) {
    const credits = g.parts.some((p) => p.qty < 0 || p.amount < -CENT);
    const parts = credits
      ? [{ qty: round2(g.parts.reduce((s, p) => s + p.qty, 0)), amount: round2(g.parts.reduce((s, p) => s + p.amount, 0)) }]
      : g.parts;
    for (const p of parts) {
      if (credits && Math.abs(p.qty) < CENT && Math.abs(p.amount) < CENT) continue;
      if (p.qty <= 0 || p.amount < -CENT) {
        return { lines: [], problem: `${g.item} nets to ${p.qty} × ${p.amount.toFixed(2)}: KatzDesk charges can't hold a credit line` };
      }
      const amount = round2(p.amount);
      const rate = round2(amount / p.qty);
      const kind = kindForItem(g.item);
      if (Math.abs(round2(p.qty * rate) - amount) <= CENT) {
        lines.push({ item: g.item, description: g.description, qty: round2(p.qty), rate, kind });
        continue;
      }
      // 2 × 104.675 = 209.35: one at 104.67 and one at 104.68.
      if (Number.isInteger(p.qty) && p.qty > 1) {
        const cents = Math.round(amount * 100);
        const base = Math.floor(cents / p.qty);
        const extra = cents - base * p.qty;
        lines.push({ item: g.item, description: g.description, qty: p.qty - extra, rate: base / 100, kind });
        if (extra) lines.push({ item: g.item, description: g.description, qty: extra, rate: (base + 1) / 100, kind });
        continue;
      }
      lines.push({ item: g.item, description: g.description, qty: round2(p.qty), rate, kind });
    }
  }
  return { lines, problem: null };
}

const lineKey = (l: { item: string; qty: number; rate: number }) => `${l.item.trim().toLowerCase()}|${round2(l.qty)}|${round2(l.rate)}`;

function sameLines(a: { item: string; qty: number; rate: number }[], b: { item: string; qty: number; rate: number }[]): boolean {
  if (a.length !== b.length) return false;
  const x = a.map(lineKey).sort();
  const y = b.map(lineKey).sort();
  return x.every((k, i) => k === y[i]);
}

const sameDiscount = (a: Discount | null, b: Discount | null) => (!a && !b) || (!!a && !!b && a.kind === b.kind && round2(a.value) === round2(b.value));

const money = (n: number) => `$${n.toFixed(2)}`;

const soKey = (so: string | null | undefined) => String(so ?? "").toUpperCase().replace(/\s+/g, "");
/** An invoice row with no Sales Order, among the SOs a WO's rows name: it is billing too, on none of them. */
const NO_SO = "no Sales Order";

/**
 * What a WO's rows are about: the Sales Orders they name (an invoice with none counts as NO_SO), the NetSuite invoices
 * they name (invoice rows, and charges from an invoice), and whether any is about a Sales Order with no invoice (an SO
 * not invoiced yet, or charges from one).
 */
type RowsAbout = { sos: Set<string>; invoices: Set<string>; soOnly: boolean };

/**
 * The ticket a WO's rows go on, or why none. A ticket merged into an install as billed (10/30) takes the rows on its
 * billing, and only those: billed on a Sales Order, the rows on that SO; billed on NetSuite invoices with no SO, the
 * rows on those invoices (their status, what's left to pay). A live ticket never gets them, and other rows (the
 * install's own billing, say) never go on it.
 */
function pickTicket(
  key: string,
  ctx: BackfillContext,
  refDate: string | null,
  rows: RowsAbout,
): { ticket: BackfillTicket } | { reason: string } {
  const all = ctx.tickets.filter((t) => woMatchKey(t.wo ?? "") === key);
  const live = all.filter((t) => !t.duplicateOf);
  const billed = all.filter((t) => t.billedOnInstall);
  const own = (t: BackfillTicket) => new Set(t.invoices.map((i) => soKey(i.invoice)));
  const ownsAny = (t: BackfillTicket) => (t.billedSoOnInstall ? rows.sos.has(soKey(t.billedSoOnInstall)) : [...rows.invoices].some((i) => own(t).has(i)));
  const ownsAll = (t: BackfillTicket) => (t.billedSoOnInstall ? rows.sos.size === 1 : !rows.soOnly && [...rows.invoices].every((i) => own(t).has(i)));
  // What the rows name, for the reasons below.
  const named = [...new Set([...rows.invoices, ...[...rows.sos].filter((s) => s !== NO_SO)])];
  const mine = billed.filter(ownsAny);
  if (mine.length) {
    const t = mine[0]!;
    if (mine.length === 1 && ownsAll(t)) return { ticket: t };
    return {
      reason: t.billedSoOnInstall
        ? `The rows are on ${[...rows.sos].join(", ")}, and ticket #${t.id} was merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}. Split the file by Sales Order, then run the Billing Backfill on each.`
        : `The rows are on ${named.join(", ")}, and ticket #${t.id} was merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}. Put the rows for ${[...rows.invoices].filter((i) => own(t).has(i)).join(", ")} in a file of their own, then run the Billing Backfill on each.`,
    };
  }
  if (!live.length) {
    if (billed.length) {
      const t = billed[0]!;
      if (!t.billedSoOnInstall) {
        return {
          reason: named.length
            ? `Ticket #${t.id} was merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}; these rows are on ${named.join(", ")}. Skipped.`
            : `Ticket #${t.id} was merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}, and these rows name none of its invoices. Skipped.`,
        };
      }
      return {
        reason: rows.sos.size
          ? `Ticket #${t.id} was merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}; these rows are on ${[...rows.sos].join(", ")}. Skipped.`
          : `Ticket #${t.id} was merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}, and these rows name no Sales Order. Skipped.`,
      };
    }
    if (all.length) {
      const intoInstall = all.find((t) => t.mergedInstallId)?.mergedInstallId;
      if (intoInstall) return { reason: `Merged into install #${intoInstall}. Billing Backfill covers service and TLC tickets.` };
      return { reason: `Merged into #${all[0]!.duplicateOf}. Skipped: its billing goes on that ticket.` };
    }
    const boards = ctx.otherBoards.get(key);
    if (boards?.length) {
      return { reason: `The WO is on ${boards.map((b) => (b === "pm" ? "PMs" : "Installs")).join(" and ")}. Billing Backfill covers service and TLC tickets.` };
    }
    return { reason: "No ticket has this WO." };
  }
  if (live.length === 1) return { ticket: live[0]! };
  // WO numbers started over in July 2026: the ticket done within a year before the invoice is the one.
  if (refDate) {
    const near = live.filter((t) => {
      const d = t.completed ?? t.received;
      if (!d) return false;
      const days = daysBetween(refDate, d);
      return days >= -7 && days <= 365;
    });
    if (near.length === 1) return { ticket: near[0]! };
  }
  return { reason: `The WO is on ${live.length} tickets (${live.map((t) => `#${t.id}`).join(", ")}). Can't tell which one NetSuite billed.` };
}

/** Plan every WO in the files against the tickets as they are now. Saves nothing. */
export function planBackfill(read: Pick<BackfillRead, "lines" | "invoices">, ctx: BackfillContext): BackfillPlan[] {
  const keys = [...new Set([...read.lines.map((l) => l.key), ...read.invoices.map((i) => i.key)])];
  return keys
    .map((key) => planOne(key, read.lines.filter((l) => l.key === key), read.invoices.filter((i) => i.key === key), ctx))
    .sort((a, b) => Number(a.key) - Number(b.key));
}

function planOne(key: string, lineRows: BackfillLine[], invoiceRows: BackfillInvoiceRow[], ctx: BackfillContext): BackfillPlan {
  const wo = lineRows[0]?.wo ?? invoiceRows[0]?.wo ?? woCanonical(key);
  const invoiceDates = invoiceRows.map((i) => i.date).filter((d): d is string => !!d).sort();
  // The Sales Orders the rows name; an invoice with none counts as its own (it is billing on none of them). And the
  // NetSuite invoices they name, for a ticket merged as billed on its invoices alone (10/30).
  const rowSos = new Set([...invoiceRows.filter((i) => i.invoice).map((i) => soKey(i.so) || NO_SO), ...invoiceRows.map((i) => soKey(i.so)), ...lineRows.map((r) => soKey(r.sourceSo))].filter(Boolean));
  const rowInvoices = new Set([...invoiceRows.map((i) => soKey(i.invoice)), ...lineRows.map((r) => soKey(r.sourceInvoice))].filter(Boolean));
  const rowSoOnly = invoiceRows.some((i) => !i.invoice && !!soKey(i.so)) || lineRows.some((r) => !soKey(r.sourceInvoice) && !!soKey(r.sourceSo));
  const picked = pickTicket(key, ctx, invoiceDates[0] ?? null, { sos: rowSos, invoices: rowInvoices, soOnly: rowSoOnly });
  const empty: BackfillPlan = {
    key,
    wo,
    status: "skip",
    reason: null,
    jobId: null,
    kind: null,
    customer: null,
    technician: null,
    seen: null,
    locked: false,
    charges: { current: [], next: null, currentNet: 0, nextNet: null, currentOff: 0, nextDiscount: null, change: false, note: null },
    so: { current: null, next: null, billedOn: null, change: false, note: null },
    invoices: [],
    amounts: { kd: 0, netsuite: 0, corrigo: null, doubleBill: false, nsMismatch: false, corrigoMismatch: false },
    warnings: [],
  };
  if ("reason" in picked) return { ...empty, reason: picked.reason };
  const t = picked.ticket;
  const base: BackfillPlan = { ...empty, jobId: t.id, kind: t.kind, customer: t.customer, technician: t.technician, seen: t.seen };
  if (!t.customer?.trim() || isWalkIn(t.customer)) {
    return { ...base, reason: "The ticket is on Walk-In, which is never a billing account. Give it the real account first." };
  }
  const warnings: string[] = [];

  // Locked: already invoiced in KatzDesk, or merged into an install as billed (10/30). Only invoice records change.
  const locked = t.invoices.some((i) => !isVoidedStatus(i.status)) || !!t.billedOnInstall;
  const currentLines: BackfillChargeLine[] = t.lines.map((l) => ({ ...l, kind: kindForItem(l.item) }));
  const current = applyDiscount(chargesTotal(t.lines), t.discount);

  // Charges from the file.
  let next: BackfillChargeLine[] | null = null;
  let nextDiscount: Discount | null = t.discount;
  let chargeNote: string | null = null;
  if (lineRows.length) {
    const built = chargeLinesFromNetSuite(lineRows);
    if (built.problem) {
      chargeNote = `Charges kept: ${built.problem}.`;
      warnings.push(chargeNote);
    } else {
      next = built.lines;
      const linesTotal = round2(lineRows.filter((r) => !isDiscountItem(r.item, r.itemType) && !NOT_A_LINE.test(r.itemType)).reduce((s, r) => s + r.amount, 0));
      // An old discount line in the file counts as the header discount.
      const lineDiscount = round2(lineRows.filter((r) => isDiscountItem(r.item, r.itemType)).reduce((s, r) => s + Math.abs(r.amount), 0));
      const header = lineRows.find((r) => r.discountAmount != null || r.recordTotal != null);
      if (header || lineDiscount > CENT) {
        let d = header
          ? discountFromNetSuite(linesTotal, header.discountAmount, header.recordTotal)
          : discountFromNetSuite(linesTotal, -lineDiscount, round2(linesTotal - lineDiscount));
        // The record's total doesn't fit its lines and discount (a discount stored with the wrong sign): the invoice
        // the charges came from decides, when it agrees with the discount.
        const billedTotal = invoiceRows.find((i) => i.chargesSource && i.invoice && i.total != null)?.total ?? null;
        const claimed = header?.discountAmount != null ? Math.abs(header.discountAmount) : lineDiscount;
        if (d.note && billedTotal != null && linesTotal - billedTotal > -CENT && Math.abs(round2(linesTotal - billedTotal) - claimed) <= 0.011) {
          d = {
            dollars: round2(linesTotal - billedTotal),
            note: `NetSuite's record total (${(header?.recordTotal ?? 0).toFixed(2)}) doesn't fit its lines and discount; the invoice total (${billedTotal.toFixed(2)}) decides.`,
          };
        }
        if (d.note) warnings.push(d.note);
        nextDiscount = d.dollars > CENT ? { kind: "amount", value: d.dollars } : null;
      }
      const items = [...new Set(lineRows.map((r) => r.discountItem.toUpperCase()).filter(Boolean))];
      if (items.some((x) => x !== "CLDSERVICE")) {
        warnings.push(`NetSuite's discount item is ${items.join(", ")}, not CLDSERVICE. Taken as the header discount.`);
      }
    }
  }
  const chargesChange = !!next && (!sameLines(next, t.lines) || !sameDiscount(nextDiscount, t.discount));
  const nextNet = next ? applyDiscount(chargesTotal(next), nextDiscount).total : null;

  // Sales Order: the one the charges came from, else the latest live invoice's, else an open SO with no invoice yet.
  // A cancelled SO is never put on a ticket.
  const sourceRow = invoiceRows.find((i) => i.chargesSource && i.invoice);
  // A row with no status says nothing about whether the invoice stands: it doesn't count as live (10/28 review).
  const liveRows = invoiceRows.filter((i) => i.invoice && i.status && !isVoidedStatus(i.status));
  const soOnly = invoiceRows.filter((i) => !i.invoice && i.so && !/cancel|closed/i.test(i.soStatus));
  const lineSo = lineRows.map((r) => r.sourceSo.toUpperCase().replace(/\s+/g, "")).find(Boolean) ?? null;
  const nextSo =
    sourceRow?.so ||
    lineSo ||
    [...liveRows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).find((i) => i.so)?.so ||
    soOnly.at(-1)?.so ||
    null;
  const billedOn = sourceRow?.date ?? [...liveRows].map((i) => i.date).filter((d): d is string => !!d).sort()[0] ?? null;
  const cancelled = invoiceRows.filter((i) => !i.invoice && i.so && /cancel/i.test(i.soStatus)).map((i) => i.so);
  let soNote: string | null = cancelled.length ? `Cancelled ${cancelled.join(", ")} left off.` : null;
  if (nextSo && t.so && nextSo !== t.so) soNote = [`NetSuite says ${nextSo}; the ticket has ${t.so}.`, soNote].filter(Boolean).join(" ");
  const soChange = !!nextSo && (nextSo !== (t.so ?? null) || (!!billedOn && billedOn !== t.billedOn));

  // Invoices: new ones, and NetSuite's status, total and remaining on the ones already there.
  const location = (inv: string) => lineRows.find((r) => r.sourceInvoice.toUpperCase().replace(/\s+/g, "") === inv && r.location)?.location ?? null;
  const seen = new Set<string>();
  const invoices: BackfillInvoicePlan[] = [];
  for (const r of invoiceRows) {
    if (!r.invoice || seen.has(r.invoice)) continue;
    seen.add(r.invoice);
    const before = t.invoices.find((i) => i.invoice.toUpperCase() === r.invoice);
    // NetSuite's status is never made up: a new invoice with no status is left out; one already here keeps its own.
    if (!r.status && !before) {
      warnings.push(`${r.invoice} has no Invoice Status in the file, so it is left out. Export the invoices with their status.`);
      continue;
    }
    const status = r.status || before!.status;
    const plan: BackfillInvoicePlan = {
      invoice: r.invoice,
      so: r.so || null,
      date: r.date ?? before?.date ?? null,
      status,
      total: r.total ?? before?.total ?? null,
      remaining: r.remaining ?? before?.remaining ?? null,
      location: location(r.invoice) ?? before?.location ?? null,
      source: r.so ? "so" : "standalone",
      change: "new",
      before: before ? { status: before.status, total: before.total, remaining: before.remaining } : null,
    };
    if (before) {
      const same =
        before.status === plan.status &&
        before.total === plan.total &&
        before.remaining === plan.remaining &&
        (before.date ?? null) === plan.date &&
        (before.so ?? null) === plan.so &&
        (before.location ?? null) === plan.location;
      plan.change = same ? "same" : "updated";
    }
    invoices.push(plan);
  }
  const invoicesChange = invoices.some((i) => i.change !== "same");

  // The account NetSuite billed, against the ticket's.
  const nsCustomer = lineRows.map((r) => r.nsCustomer).find(Boolean);
  if (nsCustomer && nameKey(leafOf(nsCustomer)) !== nameKey(t.customer) && nameKey(nsCustomer) !== nameKey(t.customer)) {
    warnings.push(`NetSuite billed ${nsCustomer}; the ticket's account is ${t.customer}.`);
  }
  // Lance bills from San Antonio WH, Bill from Dallas WH.
  for (const loc of new Set([...lineRows.map((r) => r.location), ...invoices.map((i) => i.location ?? "")].filter(Boolean))) {
    const w = locationWarning(t.technician, loc);
    if (w) warnings.push(w);
  }

  // Amounts, like for like: KatzDesk's charges after the discount, NetSuite's live invoices (after its header
  // discount; no tax on these), and Corrigo's net.
  const after = [
    ...t.invoices.filter((i) => !seen.has(i.invoice.toUpperCase())).map((i) => ({ status: i.status, total: i.total })),
    ...invoices.map((i) => ({ status: i.status, total: i.total })),
  ];
  const kd = locked || nextNet == null ? current.total : nextNet;
  const netsuite = liveInvoiceTotal(after);
  const corrigo = invoiceRows.map((i) => i.corrigoNet).find((v): v is number => v != null) ?? t.corrigoNet;
  const hasLive = after.some((i) => !isVoidedStatus(i.status));
  const amounts = {
    kd,
    netsuite,
    corrigo,
    doubleBill: possibleDoubleBill(after, kd),
    nsMismatch: hasLive && Math.abs(netsuite - kd) > CENT,
    corrigoMismatch: corrigo != null && hasLive && Math.abs(corrigo - netsuite) > CENT,
  };
  if (amounts.doubleBill) warnings.push(`Possible double bill: live invoices add up to ${money(netsuite)}, the charges to ${money(kd)}.`);
  else if (amounts.nsMismatch) warnings.push(`NetSuite's live invoices (${money(netsuite)}) don't match the charges (${money(kd)}).`);
  if (amounts.corrigoMismatch) {
    warnings.push(
      corrigo === 0
        ? `Corrigo's net is $0.00 and NetSuite billed ${money(netsuite)}: check the discount.`
        : `Corrigo's net (${money(corrigo!)}) doesn't match NetSuite (${money(netsuite)}).`,
    );
  }

  const status: BackfillStatus = locked
    ? invoicesChange
      ? "invoices"
      : "same"
    : chargesChange || soChange || invoicesChange
      ? "write"
      : "same";
  if (t.billedOnInstall) {
    warnings.push(`Merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}: only its NetSuite invoices are recorded; its charges and Sales Order stay as they are.`);
  } else if (locked && (chargesChange || soChange)) {
    warnings.push(`Locked: invoiced already, so the charges${soChange ? " and Sales Order" : ""} stay as they are. An Admin can unlock the ticket to change them.`);
  }
  return {
    ...base,
    status,
    reason: null,
    locked,
    charges: {
      current: currentLines,
      next: locked ? null : next,
      currentNet: current.total,
      nextNet: locked ? null : nextNet,
      currentOff: current.off,
      nextDiscount: locked ? t.discount : nextDiscount,
      change: !locked && chargesChange,
      note: chargeNote,
    },
    so: { current: t.so, next: locked ? t.so : (nextSo ?? t.so), billedOn: locked ? t.billedOn : billedOn, change: !locked && soChange, note: soNote },
    invoices,
    amounts,
    warnings,
  };
}

/**
 * A fingerprint of everything a confirm would write (and the tickets' updated_at): the write is refused when the plan
 * made again doesn't match the one the Admin looked at. FNV-1a, twice over: a change check, not security.
 */
export function backfillHash(plans: BackfillPlan[]): string {
  const text = JSON.stringify(
    plans.map((p) => [p.key, p.status, p.jobId, p.seen, p.charges.next, p.charges.nextDiscount, p.so.change ? [p.so.next, p.so.billedOn] : null, p.invoices]),
  );
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193) >>> 0;
    b = Math.imul(b ^ c, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

export function backfillCounts(plans: BackfillPlan[]) {
  const n = (s: BackfillStatus) => plans.filter((p) => p.status === s).length;
  return {
    total: plans.length,
    write: n("write"),
    invoices: n("invoices"),
    same: n("same"),
    skip: n("skip"),
    doubleBill: plans.filter((p) => p.amounts.doubleBill).length,
    nsMismatch: plans.filter((p) => p.amounts.nsMismatch && !p.amounts.doubleBill).length,
    corrigoMismatch: plans.filter((p) => p.amounts.corrigoMismatch).length,
    warnings: plans.filter((p) => p.warnings.length).length,
  };
}

/** The history line a backfilled ticket gets. */
export function backfillLogLine(p: BackfillPlan): string {
  const parts: string[] = [];
  if (p.charges.change && p.charges.next) {
    const sub = chargesTotal(p.charges.next);
    const off = applyDiscount(sub, p.charges.nextDiscount).off;
    parts.push(`charges ${p.charges.next.length} line${p.charges.next.length === 1 ? "" : "s"} ${money(sub)}${off ? `, discount ${money(off)} off, total ${money(round2(sub - off))}` : ""}`);
  }
  if (p.so.change && p.so.next) parts.push(`Sales Order ${p.so.next}${p.so.billedOn ? ` (billed ${p.so.billedOn})` : ""}`);
  const inv = p.invoices.filter((i) => i.change !== "same");
  if (inv.length) {
    parts.push(
      `invoices: ${inv
        .map((i) =>
          i.change === "new"
            ? `${i.invoice} new (${i.status}${i.total != null ? ` ${money(i.total)}` : ""})`
            : `${i.invoice} ${i.before!.status === i.status ? i.status : `${i.before!.status} → ${i.status}`}${i.remaining != null ? ` (${money(i.remaining)} remaining)` : ""}`,
        )
        .join(", ")}`,
    );
  }
  if (p.locked) parts.push("charges, P.O., discount and SO kept (locked)");
  return `Billing Backfill (NetSuite): ${parts.join(" · ") || "no change"}`;
}
