/**
 * Billing Backfill (Grok's billing request through Chuy, 2026-10-28): NetSuite's charges, Sales Orders and invoices
 * brought back onto KatzDesk records, keyed by WO. Admin only, preview first. Service and TLC tickets since 10/28;
 * installs and PMs since 11/5 (Grok through Chuy), matched by WO the same way.
 *
 * Files (CSV or Excel, either or both, columns read by header name):
 * - charges: WO, Source invoice #, Source SO #, NetSuite customer, Location, Item, Item type, Description, Qty, Rate,
 *   Amount, Discount Item, Discount Amount, Record total (after discount). The lines of one NetSuite record per WO.
 * - invoices: WO, SO #, SO status, Invoice #, Invoice date, Invoice status, Invoice total, Amount remaining,
 *   Charges source, Corrigo net (reference). One row per invoice (Voided ones too), and Sales Orders with no invoice yet.
 *
 * Per record (a ticket, or one WO of an install or a PM):
 * - not locked (no live invoice in KatzDesk yet): charges first (credit lines netted by item, the discount as the
 *   header discount in dollars), then the Sales Order and its billed date, then the invoices. A ticket's charges are
 *   its ticket_charges; an install's or a PM's are NetSuite's lines kept beside its own invoice (record_ns_billing),
 *   billed already, which Export Billing never reads;
 * - locked (an invoice that isn't Voided is already on it): only invoice records (number, status, total, remaining).
 *   Charges, P.O., discount, Sales Order and billed date are never touched;
 * - skipped: no record with the WO, a merged (duplicate) ticket or install, a PM stacked on a ticket, an install taken
 *   off the board, a WO on two records the invoice dates can't tell apart, or a record on Walk-In (never a billing
 *   account).
 *
 * Pure: no server imports, safe for node --test.
 */
import { chargesTotal, kindForItem, round2, type ChargeKind } from "./charges.ts";
import { applyDiscount, billTotals, type Discount } from "./discount.ts";
import {
  discountFromNetSuite,
  invoiceFitsTicket,
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

/** What a WO's billing goes on: a service or TLC ticket, an install or a PM (installs and PMs since 11/5). */
export type BackfillKind = "service" | "tlc" | "install" | "pm";

export const BACKFILL_KIND_LABEL: Record<BackfillKind, string> = {
  service: "Ticket",
  tlc: "TLC",
  install: "Install",
  pm: "PM",
};

type StoredNsInvoice = { invoice: string; so: string | null; date: string | null; status: string; total: number | null; remaining: number | null; location: string | null };

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
  /** discountChosen: the line's tick for a Chosen-lines discount (11/7). */
  lines: { item: string; description: string; qty: number; rate: number; discountChosen?: boolean }[];
  invoices: StoredNsInvoice[];
};

/**
 * A ticket merged into an install as billed (10/30), as the install carries it: its billing stays its own and the
 * install shows it as billed already. `sos` and `named` are soKey'd (its Sales Order; the NetSuite invoices the merge
 * logged); `invoices` are the ones recorded on the ticket now.
 */
export type BackfillCarried = { jobId: number; sos: string[]; named: string[]; invoices: StoredNsInvoice[] };

/** An install or a PM carrying one of the files' WOs, as the plan needs it (11/5). One per record and WO. */
export type BackfillRecord = {
  id: number;
  kind: "install" | "pm";
  /** The WO's match key, and the WO as the record carries it. */
  woKey: string;
  wo: string;
  customer: string | null;
  technician: string | null;
  /** YYYY-MM-DD: when this WO came in and was done (an install's WO row, else the install; a PM's own). */
  received: string | null;
  completed: string | null;
  /** Why it can't take billing (taken off the board, merged into another install, a PM stacked on a ticket). */
  blocked: string | null;
  /** updated_at as text: the write skips a record that changed after the plan. */
  seen: string;
  /** NetSuite's billing for this WO from an earlier run: its Sales Order, billed date, discount and lines. */
  so: string | null;
  billedOn: string | null;
  discount: Discount | null;
  lines: { item: string; description: string; qty: number; rate: number }[];
  /** Every NetSuite invoice on the record, whichever of its WOs it came in on (woKey). */
  invoices: (StoredNsInvoice & { woKey: string | null })[];
  /** The record's other WOs' NetSuite charges, after their discounts. */
  otherNet: number;
  /** Each of the record's WOs with NetSuite billing from earlier runs: its net after its discount, and whether it has lines or a discount. */
  nsWos?: { woKey: string; net: number; charges: boolean }[];
  /** KatzDesk's own invoice (the Invoice window), when it has lines: how many, and the total after its discount. */
  katzdesk: { lines: number; net: number } | null;
  /** An install's tickets merged in as billed: their billing is on the install's card already. */
  carried: BackfillCarried[];
};

export type BackfillStatus = "write" | "invoices" | "same" | "skip";

/** Every WO is one of: will write (all of it, or the invoices only), already there, or skipped (Grok, 11/5). */
export const BACKFILL_STATUS_LABEL: Record<BackfillStatus, string> = {
  write: "Will Write",
  invoices: "Will Write: Invoices Only",
  same: "Already There",
  skip: "Skipped",
};

/**
 * One invoice in the files, for the WO's record: new or updated (written), the same as recorded (already there),
 * elsewhere (on the record's card through a ticket merged into it as billed: not written here, not counted twice), or
 * skipped (no Invoice Status in the file). `note` says why for the last two.
 */
export type BackfillInvoiceChange = "new" | "updated" | "same" | "elsewhere" | "skip";

export type BackfillInvoicePlan = {
  invoice: string;
  so: string | null;
  date: string | null;
  status: string;
  total: number | null;
  remaining: number | null;
  location: string | null;
  source: "so" | "standalone";
  change: BackfillInvoiceChange;
  before: { status: string; total: number | null; remaining: number | null } | null;
  note?: string | null;
};

/** The invoice is written by the plan. */
export const writesInvoice = (i: Pick<BackfillInvoicePlan, "change">) => i.change === "new" || i.change === "updated";

export type BackfillPlan = {
  key: string;
  wo: string;
  status: BackfillStatus;
  reason: string | null;
  /** The ticket written; null for an install or a PM (recordId). */
  jobId: number | null;
  /** What is written: a ticket (service, tlc), an install or a PM, and its id. */
  kind: BackfillKind | null;
  recordId: number | null;
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
    /** The file's charges differ from the record's (lines or discount). */
    change: boolean;
    note: string | null;
  };
  so: { current: string | null; next: string | null; billedOn: string | null; change: boolean; note: string | null };
  invoices: BackfillInvoicePlan[];
  /**
   * kd: what KatzDesk says the record bills. A ticket's charges; an install's or a PM's own invoice (the Invoice
   * window) when it has lines, else NetSuite's charges on it (kdSource). An install or a PM with neither has nothing to
   * check its invoices against ("none"): no mismatch, no double bill.
   */
  amounts: {
    kd: number;
    kdSource: "charges" | "katzdesk" | "netsuite" | "none";
    netsuite: number;
    corrigo: number | null;
    doubleBill: boolean;
    nsMismatch: boolean;
    corrigoMismatch: boolean;
  };
  warnings: string[];
};

export type BackfillContext = {
  tickets: BackfillTicket[];
  /** Installs and PMs carrying the files' WOs, one per record and WO (11/5). */
  records?: BackfillRecord[];
  /** WO match keys on the PM and Install boards (what the skips said before 11/5; records decide now). */
  otherBoards: Map<string, ("pm" | "install")[]>;
  /** Where the files' NetSuite invoices are recorded already, by soKey'd number. */
  recordedAt?: Map<string, { kind: BackfillKind; id: number }[]>;
};

const CENT = 0.005;

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

const sameDiscount = (a: Discount | null, b: Discount | null) =>
  (!a && !b) || (!!a && !!b && a.kind === b.kind && round2(a.value) === round2(b.value) && (a.scope ?? "all") === (b.scope ?? "all"));

const money = (n: number) => `$${n.toFixed(2)}`;

const soKey = (so: string | null | undefined) => String(so ?? "").toUpperCase().replace(/\s+/g, "");
/** An invoice row with no Sales Order, among the SOs a WO's rows name: it is billing too, on none of them. */
const NO_SO = "no Sales Order";

/**
 * What a WO's rows are about: the Sales Orders they name (an invoice with none counts as NO_SO), the NetSuite invoices
 * they name (invoice rows, and charges from an invoice), whether any is about a Sales Order with no invoice (an SO not
 * invoiced yet, or charges from one), and the invoices that have a date and aren't Voided, with it.
 */
type RowsAbout = { sos: Set<string>; invoices: Set<string>; soOnly: boolean; dated: { invoice: string; date: string }[] };

/** What a WO's billing can go on; `warning`, for the plan, when it was picked without an invoice date to go by. */
type Candidate = ({ ticket: BackfillTicket } | { record: BackfillRecord }) & { warning?: string };

const candidateId = (c: Candidate) => ("ticket" in c ? c.ticket.id : c.record.id);
const candidateDates = (c: Candidate) => ("ticket" in c ? c.ticket : c.record);
const candidateInvoices = (c: Candidate): StoredNsInvoice[] => ("ticket" in c ? c.ticket.invoices : c.record.invoices);
/** "ticket #12", "install #4", "PM #7". */
const candidateName = (c: Candidate) => ("ticket" in c ? `ticket #${c.ticket.id}` : c.record.kind === "install" ? `install #${c.record.id}` : `PM #${c.record.id}`);

/** An invoice or Sales Order a ticket merged into the install as billed carries: its billing, not the install's. */
function carriedBy(r: BackfillRecord, row: { invoice?: string | null; so?: string | null }): BackfillCarried | null {
  const inv = soKey(row.invoice);
  const so = soKey(row.so);
  return (
    r.carried.find(
      (c) => (!!inv && (c.named.includes(inv) || c.invoices.some((i) => soKey(i.invoice) === inv))) || (!!so && c.sos.includes(so)),
    ) ?? null
  );
}

/**
 * Beside an install or a PM, of the records an invoice fits, one is its billing when it was done at least this many days
 * closer to the invoice than any other (11/5 review): a new ticket and an old PM with one number, not two jobs weeks apart.
 */
const CLOSER_BY_DAYS = 45;

const dayOf = (iso: string) => Date.parse(`${iso}T12:00:00Z`) / 86_400_000;

/**
 * Where a WO's rows go, or why nowhere. A ticket merged into an install as billed (10/30) takes the rows on its
 * billing, and only those: billed on a Sales Order, the rows on that SO; billed on NetSuite invoices with no SO, the
 * rows on those invoices (their status, what's left to pay). Otherwise the WO's live tickets, installs and PMs (11/5)
 * are the candidates; WO numbers started over in July 2026, so the invoice dates pick among them. The WO's other rows
 * beside a billed merged ticket's go through the same checks: the install the ticket went into takes them only when it
 * is the record they fit.
 */
function pickTarget(key: string, ctx: BackfillContext, invoiceRows: BackfillInvoiceRow[], lineRows: BackfillLine[], rows: RowsAbout): Candidate | { reason: string } {
  const all = ctx.tickets.filter((t) => woMatchKey(t.wo ?? "") === key);
  const live = all.filter((t) => !t.duplicateOf);
  const billed = all.filter((t) => t.billedOnInstall);
  const recs = (ctx.records ?? []).filter((r) => r.woKey === key);
  const open = recs.filter((r) => !r.blocked);
  const own = (t: BackfillTicket) => new Set(t.invoices.map((i) => soKey(i.invoice)));
  const ownsAny = (t: BackfillTicket) => (t.billedSoOnInstall ? rows.sos.has(soKey(t.billedSoOnInstall)) : [...rows.invoices].some((i) => own(t).has(i)));
  const ownsAll = (t: BackfillTicket) => (t.billedSoOnInstall ? rows.sos.size === 1 : !rows.soOnly && [...rows.invoices].every((i) => own(t).has(i)));
  // What the rows name, for the reasons below.
  const named = [...new Set([...rows.invoices, ...[...rows.sos].filter((s) => s !== NO_SO)])];
  const cands: Candidate[] = [...live.map((t) => ({ ticket: t })), ...open.map((r) => ({ record: r }))];
  const ticketsOnly = cands.every((c) => "ticket" in c);
  const tag = (c: Candidate) => (ticketsOnly ? `#${candidateId(c)}` : candidateName(c));
  const fit = (date: string, c: Candidate) => invoiceFitsTicket(date, candidateDates(c).received, candidateDates(c).completed) === true;
  // Tickets among themselves go by the year's window, as since 10/30. Beside an install or a PM (11/5), two records in
  // the year's window are told apart by how long after each was done the invoice is dated (none for one dated while it
  // was being done; from when it came in, for one not done yet): one at least CLOSER_BY_DAYS closer than the rest is the
  // one. A new ticket and an old PM with one number go to the ticket, as before installs and PMs took billing; two jobs
  // in the same weeks can't be told apart. A record the rows' billing is on already goes first (see choose).
  const belongs = (date: string): Candidate[] => {
    const loose = cands.filter((c) => fit(date, c));
    if (ticketsOnly || loose.length < 2) return loose;
    const after = (c: Candidate) => Math.max(0, Math.round(dayOf(date) - dayOf((candidateDates(c).completed || candidateDates(c).received)!)));
    const best = Math.min(...loose.map(after));
    return loose.filter((c) => after(c) < best + CLOSER_BY_DAYS);
  };
  // The rows' invoices and Sales Orders recorded on a record already: theirs, when nothing else tells (11/5 review).
  const holds = (c: Candidate, inv: Set<string>, sos: Set<string>) => {
    const so = soKey("ticket" in c ? c.ticket.so : c.record.so);
    return (!!so && sos.has(so)) || candidateInvoices(c).some((i) => inv.has(soKey(i.invoice)));
  };
  // An install or a PM with this WO's NetSuite billing already (from an earlier run), or a ticket merged into it as
  // billed with this WO: what it has, for the reasons, or null.
  const billedHere = (r: BackfillRecord): string | null => {
    if (r.so || r.lines.length || r.discount || r.invoices.some((i) => i.woKey === key && !isVoidedStatus(i.status))) return "has NetSuite billing for it already";
    const merged = billed.find((t) => t.mergedInstallId === r.id);
    return merged ? `carries ticket #${merged.id}'s billing, merged in as billed` : null;
  };
  // Every dated invoice in the rows has to fit the record they go on (Chuy, 10/30), even the only one with this WO
  // number: the numbers started over in July 2026, so an invoice dated well before it came in, or more than a year
  // after it was done, is another job's, not its billing.
  const tooFar = (c: Candidate, dated: RowsAbout["dated"], only: boolean): { reason: string } | null => {
    const d = candidateDates(c);
    const far = dated.filter((r) => invoiceFitsTicket(r.date, d.received, d.completed) === false);
    if (!far.length) return null;
    const one = far.length === 1;
    const when = [d.received ? `came in ${d.received}` : null, d.completed ? `done ${d.completed}` : null].filter(Boolean).join(", ");
    const already = far.filter((r) => candidateInvoices(c).some((i) => soKey(i.invoice) === soKey(r.invoice)));
    return {
      reason:
        `${far.map((r) => `${r.invoice} (${r.date})`).join(", ")} ${one ? "is" : "are"} too far from ${candidateName(c)} (${when})` +
        `${only ? ", the only one with this WO," : ""} to be its billing: ${one ? "it" : "they"} may be another job with this WO number.` +
        (already.length ? ` ${already.map((r) => r.invoice).join(", ")} ${already.length === 1 ? "is" : "are"} on the ${"ticket" in c ? "ticket" : c.record.kind === "install" ? "install" : "PM"} already, from an earlier run: check ${already.length === 1 ? "it" : "them"} in NetSuite.` : "") +
        ` Take ${one ? "its" : "their"} rows out of the file, then run it again.`,
    };
  };
  /**
   * The one record the rows go on. `dated(c)`: the dated invoices that are c's to check (not a ticket's billing an
   * install carries); `refDate`: the earliest invoice date among them; `inv` and `sos`: the invoices and Sales Orders the
   * rows name.
   */
  const choose = (refDate: string | null, dated: (c: Candidate) => RowsAbout["dated"], inv: Set<string>, sos: Set<string>): Candidate | { reason: string } => {
    let noDateWhy: string | null = null;
    if (cands.length === 1) return tooFar(cands[0]!, dated(cands[0]!), true) ?? cands[0]!;
    // A rerun beside an install or a PM (11/5 re-review): the record the rows' invoices or Sales Orders are recorded on
    // already keeps the WO, whatever the dates say about the others. A new invoice in the rows dated to fit another
    // record, and not it, stops the WO.
    const anchored = ticketsOnly ? [] : cands.filter((c) => holds(c, inv, sos));
    if (anchored.length === 1) {
      const c = anchored[0]!;
      const recorded = new Set(candidateInvoices(c).map((i) => soKey(i.invoice)));
      for (const r of dated(c)) {
        if (recorded.has(soKey(r.invoice))) continue;
        const fits = belongs(r.date);
        if (!fits.length || fits.includes(c)) continue;
        return {
          reason: `${r.invoice} (${r.date}) fits ${fits.map(candidateName).join(", ")}, not ${candidateName(c)}, where this WO's billing is already: put its rows in a file of their own and run that too.`,
        };
      }
      return tooFar(c, dated(c), false) ?? c;
    }
    // WO numbers started over in July 2026: the record the earliest invoice fits is the one. Every other invoice has to
    // be that record's alone: one that fits another record with this WO, instead or as well, can't be told apart, and
    // putting it on this one would leave that one unbilled (Export Billing would take a ticket again).
    if (refDate) {
      const near = belongs(refDate);
      if (near.length === 1) {
        const c = near[0]!;
        for (const r of dated(c)) {
          const fits = belongs(r.date);
          const others = fits.filter((x) => x !== c).map(tag);
          if (!others.length) continue;
          return {
            reason: fits.includes(c)
              ? `${r.invoice} (${r.date}) fits ${ticketsOnly ? "tickets " : ""}${tag(c)} and ${others.join(", ")} both, so the Backfill can't tell which one NetSuite billed. Skipped.`
              : `${r.invoice} (${r.date}) fits ${ticketsOnly ? "ticket " : ""}${others.join(", ")}, not ${tag(c)}: put its rows in a file of their own and run that too.`,
          };
        }
        return tooFar(c, dated(c), false) ?? c;
      }
    } else if (!ticketsOnly) {
      // No invoice date to go by, and no record the rows are recorded on (above). The WO's one live ticket keeps it, as
      // before installs and PMs took billing, unless an install or a PM has this WO's billing already (then it could be
      // either: skipped). The plan says what else carries the WO.
      const tickets = cands.filter((c) => "ticket" in c);
      const billedRecs = cands.filter((c) => "record" in c && billedHere(c.record));
      if (!anchored.length && tickets.length === 1 && !billedRecs.length) {
        const others = cands.filter((c) => c !== tickets[0]).map(candidateName);
        return {
          ...tickets[0]!,
          warning: `${others.join(", ").replace(/^./, (s) => s.toUpperCase())} ${others.length === 1 ? "carries" : "carry"} this WO too. With no invoice date in the files to tell them apart, the ticket takes it, as before installs and PMs took billing: make sure it's the ticket's.`,
        };
      }
      noDateWhy = anchored.length
        ? `the rows' invoices or Sales Orders are on ${anchored.map(candidateName).join(" and ")} already`
        : billedRecs.length
          ? billedRecs.map((c) => `${candidateName(c)} ${billedHere((c as { record: BackfillRecord }).record)}`).join("; ")
          : null;
    }
    if (ticketsOnly) return { reason: `The WO is on ${cands.length} tickets (${cands.map(tag).join(", ")}). Can't tell which one NetSuite billed.` };
    // A ticket and an install or a PM with one WO (11/5): say what the dates couldn't settle.
    const names = cands.map(candidateName).join(", ");
    if (!refDate) return { reason: `The WO is on ${names}, and the files have no invoice date to tell them apart${noDateWhy ? ` (${noDateWhy})` : ""}. Skipped.` };
    const fitting = belongs(refDate);
    // A ticket and an install of one account in the same weeks are likely one job: say how to make them one.
    const sameJob =
      fitting.some((c) => "ticket" in c) &&
      fitting.some((c) => "record" in c && c.record.kind === "install") &&
      new Set(fitting.map((c) => nameKey(("ticket" in c ? c.ticket : c.record).customer))).size === 1;
    return {
      reason: fitting.length
        ? `The WO is on ${names}, and the invoice date (${refDate}) fits ${fitting.length === cands.length ? "each of them" : fitting.map(candidateName).join(" and ")}, so the Backfill can't tell which one NetSuite billed. Skipped.` +
          (sameJob ? " If the ticket is the install's work, merge it into the install first (Merge into install), then run it again." : "")
        : `The WO is on ${names}, and the invoice date (${refDate}) fits none of them (by when each came in and was done). Skipped.`,
    };
  };
  // A ticket's billing an install carries is the ticket's: its dates aren't the install's to check.
  const ownDated = (c: Candidate, dated: RowsAbout["dated"]) => ("record" in c ? dated.filter((d) => !carriedBy(c.record, { invoice: d.invoice })) : dated);
  const earliest = (list: BackfillInvoiceRow[]) => list.map((i) => i.date).filter((d): d is string => !!d).sort()[0] ?? null;

  const mine = billed.filter(ownsAny);
  if (mine.length) {
    const t = mine[0]!;
    if (mine.length === 1 && ownsAll(t)) return { ticket: t };
    // The rows beside the ticket's own are the WO's own billing: the install the ticket went into takes them when it
    // carries the WO and they are its by the same checks as any WO's (the ticket's rows then count as on its card).
    const home = mine.length === 1 ? open.find((r) => r.kind === "install" && r.id === t.mergedInstallId) : undefined;
    if (home) {
      const restInvoices = invoiceRows.filter((i) => !carriedBy(home, i));
      const restLines = lineRows.filter((r) => !carriedBy(home, { invoice: r.sourceInvoice, so: r.sourceSo }));
      // Every row is the ticket's: they are on the install's card already (the plan lists them, and stops the WO if
      // one would change the ticket).
      if (!restInvoices.length && !restLines.length) return { record: home };
      const rest = rows.dated.filter((d) => !carriedBy(home, { invoice: d.invoice }));
      const restRef = earliest(restInvoices);
      const restInv = new Set([...restInvoices.map((i) => soKey(i.invoice)), ...restLines.map((r) => soKey(r.sourceInvoice))].filter(Boolean));
      const restSos = new Set([...restInvoices.map((i) => soKey(i.so)), ...restLines.map((r) => soKey(r.sourceSo))].filter(Boolean));
      const others = cands.filter((c) => !("record" in c && c.record === home));
      if (!restRef && others.length) {
        // Recorded on the install already (a rerun): its. On another record: that one's, in a run of their own.
        // Nowhere: the dates have to tell.
        const anchored = cands.filter((c) => holds(c, restInv, restSos));
        if (anchored.length === 1 && "record" in anchored[0]! && anchored[0].record === home) return anchored[0]!;
        if (anchored.length === 1) {
          return {
            reason: `The rows beside ticket #${t.id}'s own billing are ${candidateName(anchored[0]!)}'s (its invoices or Sales Order already). Put ticket #${t.id}'s rows in a file of their own, then run the Billing Backfill on each.`,
          };
        }
        return {
          reason: `The rows beside ticket #${t.id}'s own billing have no invoice date to tell install #${home.id} (where the ticket was merged as billed) from ${others.map(candidateName).join(", ")}. Run them with their NetSuite invoices, so the invoice dates can tell, or merge the other ticket into the install if it's the same job. Skipped.`,
        };
      }
      const c = choose(restRef, (x) => ownDated(x, rest), restInv, restSos);
      if ("reason" in c) return c;
      if ("record" in c && c.record === home) return c;
      return {
        reason: `The rows beside ticket #${t.id}'s own billing fit ${candidateName(c)}, not install #${home.id} (where the ticket was merged as billed). Put ticket #${t.id}'s rows in a file of their own, then run the Billing Backfill on each.`,
      };
    }
    return {
      reason: t.billedSoOnInstall
        ? `The rows are on ${[...rows.sos].join(", ")}, and ticket #${t.id} was merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}. Split the file by Sales Order, then run the Billing Backfill on each.`
        : `The rows are on ${named.join(", ")}, and ticket #${t.id} was merged into install #${t.mergedInstallId} as billed on ${t.billedOnInstall}. Put the rows for ${[...rows.invoices].filter((i) => own(t).has(i)).join(", ")} in a file of their own, then run the Billing Backfill on each.`,
    };
  }
  if (!cands.length) {
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
      if (intoInstall) {
        const there = recs.find((r) => r.kind === "install" && r.id === intoInstall);
        return { reason: there?.blocked ? `Merged into install #${intoInstall}. ${there.blocked} Skipped.` : `Merged into install #${intoInstall}, which doesn't carry this WO. Skipped.` };
      }
      return { reason: `Merged into #${all[0]!.duplicateOf}. Skipped: its billing goes on that ticket.` };
    }
    if (recs.length) return { reason: `${[...new Set(recs.map((r) => r.blocked))].join(" ")} Skipped.` };
    return { reason: "No ticket, install or PM has this WO." };
  }
  // The rows' own date: not a ticket's billing an install carries (its invoice dated when the ticket was billed).
  const notCarried = invoiceRows.filter((i) => !open.some((r) => carriedBy(r, i)));
  return choose(earliest(notCarried.length ? notCarried : invoiceRows), (c) => ownDated(c, rows.dated), rows.invoices, new Set([...rows.sos].filter((s) => s !== NO_SO)));
}

/** Plan every WO in the files against the records as they are now. Saves nothing. */
export function planBackfill(read: Pick<BackfillRead, "lines" | "invoices">, ctx: BackfillContext): BackfillPlan[] {
  const keys = [...new Set([...read.lines.map((l) => l.key), ...read.invoices.map((i) => i.key)])];
  const plans = keys
    .map((key) => planOne(key, read.lines.filter((l) => l.key === key), read.invoices.filter((i) => i.key === key), ctx))
    .sort((a, b) => Number(a.key) - Number(b.key));
  // An install carrying two of the files' WOs gets one plan per WO. One NetSuite invoice in both would be written
  // twice on it: the later WO waits for a run of its own.
  const claimed = new Map<string, string>();
  const out = plans.map((p) => {
    if (p.status === "skip" || p.recordId == null || p.jobId != null) return p;
    const mine = p.invoices.filter(writesInvoice).map((i) => `${p.kind}:${p.recordId}|${soKey(i.invoice)}`);
    const twice = mine.map((k) => [k, claimed.get(k)] as const).find(([, wo]) => wo);
    if (twice) {
      const inv = twice[0].split("|")[1];
      return { ...p, status: "skip" as const, reason: `${inv} is in the files under ${twice[1]} too, for the same ${p.kind === "pm" ? "PM" : "install"} (#${p.recordId}). Take ${p.wo}'s rows out and run them on their own after this.` };
    }
    for (const k of mine) claimed.set(k, p.wo);
    return p;
  });
  return recordChecks(sharedInvoices(out, ctx), ctx);
}

const planTarget = (p: BackfillPlan) => (p.jobId != null ? `ticket:${p.jobId}` : `${p.kind}:${p.recordId}`);
const planName = (p: BackfillPlan) => (p.jobId != null ? `ticket #${p.jobId}` : p.kind === "install" ? `install #${p.recordId}` : `PM #${p.recordId}`);
/** A recorded-at entry is this plan's record (a ticket's are recorded as service or TLC). */
const isPlanTarget = (x: { kind: BackfillKind; id: number }, p: BackfillPlan) =>
  p.jobId != null ? x.id === p.jobId && (x.kind === "service" || x.kind === "tlc") : x.id === p.recordId && x.kind === p.kind;

/**
 * One NetSuite invoice under the WOs of two records in the files (11/5 review): written on each, as when it is on
 * another record already, and said on both. An invoice both have already is said by the recorded-at warning.
 */
function sharedInvoices(plans: BackfillPlan[], ctx: BackfillContext): BackfillPlan[] {
  const by = new Map<string, { text: string; plans: BackfillPlan[] }>();
  for (const p of plans) {
    if (p.status === "skip") continue;
    for (const i of p.invoices) {
      if (!writesInvoice(i) && i.change !== "same") continue;
      const k = soKey(i.invoice);
      const e = by.get(k) ?? { text: i.invoice, plans: [] };
      if (!e.plans.includes(p)) e.plans.push(p);
      by.set(k, e);
    }
  }
  const more = new Map<BackfillPlan, string[]>();
  for (const [k, e] of by) {
    for (const p of e.plans) {
      const said = (ctx.recordedAt?.get(k) ?? []).filter((x) => !isPlanTarget(x, p));
      const others = e.plans.filter((q) => planTarget(q) !== planTarget(p) && !said.some((x) => isPlanTarget(x, q)));
      if (!others.length) continue;
      more.set(p, [
        ...(more.get(p) ?? []),
        `${e.text} is in the files under ${others.map((q) => `${q.wo} (${planName(q)})`).join(", ")} too. NetSuite billed both on one invoice, or a WO is wrong: check it in NetSuite.`,
      ]);
    }
  }
  return plans.map((p) => (more.has(p) ? { ...p, warnings: [...p.warnings, ...more.get(p)!] } : p));
}

/** The mismatch or double-bill warning for a plan's amounts (none when they agree, or there's nothing to check). */
function amountWarning(a: BackfillPlan["amounts"], what: string): string | null {
  const kdWords = a.kdSource === "katzdesk" ? `the ${what}'s own invoice in KatzDesk` : "the charges";
  if (a.doubleBill) return `Possible double bill: live invoices add up to ${money(a.netsuite)}, ${kdWords} to ${money(a.kd)}.`;
  if (a.nsMismatch) return `NetSuite's live invoices (${money(a.netsuite)}) don't match ${kdWords} (${money(a.kd)}).`;
  return null;
}
const isAmountWarning = (w: string) => w.startsWith("Possible double bill: ") || w.startsWith("NetSuite's live invoices (");

/** NetSuite's charges on a record's WOs other than `keys` (from earlier runs): there are some. */
function chargesBeyond(rec: BackfillRecord, keys: Set<string>): boolean {
  return rec.nsWos ? rec.nsWos.some((w) => !keys.has(w.woKey) && w.charges) : rec.otherNet !== 0;
}

/**
 * An install with several of the files' WOs gets one plan per WO, and each counted its own WO's new invoices and
 * charges only. Its checks are the install's (11/5 review): all its invoices and all its charges, after the run.
 */
function recordChecks(plans: BackfillPlan[], ctx: BackfillContext): BackfillPlan[] {
  const groups = new Map<string, BackfillPlan[]>();
  for (const p of plans) {
    if (p.status === "skip" || p.jobId != null || p.recordId == null) continue;
    groups.set(planTarget(p), [...(groups.get(planTarget(p)) ?? []), p]);
  }
  const redone = new Map<BackfillPlan, BackfillPlan["amounts"]>();
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const first = list[0]!;
    const rec = (ctx.records ?? []).find((r) => r.kind === first.kind && r.id === first.recordId && r.woKey === first.key);
    if (!rec) continue;
    const keys = new Set(list.map((p) => p.key));
    // The record's invoices after the run: the ones on it the files don't list, and each file invoice once.
    const listed = new Set(list.flatMap((p) => p.invoices.map((i) => soKey(i.invoice))));
    const counted = new Map<string, { status: string; total: number | null }>();
    for (const p of list) for (const i of p.invoices) if (writesInvoice(i) || i.change === "same") counted.set(soKey(i.invoice), { status: i.status, total: i.total });
    const after = [...rec.invoices.filter((i) => !listed.has(soKey(i.invoice))).map((i) => ({ status: i.status, total: i.total })), ...counted.values()];
    // Its charges after the run: the files' WOs as planned, its other WOs as they are.
    const outside = round2(rec.otherNet - list.slice(1).reduce((s, p) => s + p.charges.currentNet, 0));
    const nsNet = round2(outside + list.reduce((s, p) => s + (p.charges.nextNet ?? p.charges.currentNet), 0));
    const hasNs = list.some((p) => (p.charges.next ?? p.charges.current).length > 0 || !!p.charges.nextDiscount) || chargesBeyond(rec, keys);
    const kdSource = rec.katzdesk ? "katzdesk" : hasNs ? "netsuite" : "none";
    const kd = rec.katzdesk?.net ?? nsNet;
    const netsuite = liveInvoiceTotal(after);
    const hasLive = after.some((i) => !isVoidedStatus(i.status));
    for (const p of list) {
      redone.set(p, {
        ...p.amounts,
        kd,
        kdSource,
        netsuite,
        doubleBill: kdSource !== "none" && possibleDoubleBill(after, kd),
        nsMismatch: kdSource !== "none" && hasLive && Math.abs(netsuite - kd) > CENT,
      });
    }
  }
  return plans.map((p) => {
    const amounts = redone.get(p);
    if (!amounts) return p;
    const what = p.kind === "install" ? "install" : "PM";
    const w = amountWarning(amounts, what);
    const at = p.warnings.findIndex(isAmountWarning);
    const warnings = p.warnings.filter((x) => !isAmountWarning(x));
    if (w) warnings.splice(at < 0 ? warnings.length : at, 0, w);
    return { ...p, amounts, warnings };
  });
}

const SAME_INVOICE = (before: StoredNsInvoice, plan: Pick<BackfillInvoicePlan, "status" | "total" | "remaining" | "date" | "so" | "location">) =>
  before.status === plan.status &&
  before.total === plan.total &&
  before.remaining === plan.remaining &&
  (before.date ?? null) === plan.date &&
  (before.so ?? null) === plan.so &&
  (before.location ?? null) === plan.location;

function planOne(key: string, lineRowsIn: BackfillLine[], invoiceRows: BackfillInvoiceRow[], ctx: BackfillContext): BackfillPlan {
  const wo = lineRowsIn[0]?.wo ?? invoiceRows[0]?.wo ?? woCanonical(key);
  // The Sales Orders the rows name; an invoice with none counts as its own (it is billing on none of them). And the
  // NetSuite invoices they name, for a ticket merged as billed on its invoices alone (10/30).
  const rowSos = new Set([...invoiceRows.filter((i) => i.invoice).map((i) => soKey(i.so) || NO_SO), ...invoiceRows.map((i) => soKey(i.so)), ...lineRowsIn.map((r) => soKey(r.sourceSo))].filter(Boolean));
  const rowInvoices = new Set([...invoiceRows.map((i) => soKey(i.invoice)), ...lineRowsIn.map((r) => soKey(r.sourceInvoice))].filter(Boolean));
  const rowSoOnly = invoiceRows.some((i) => !i.invoice && !!soKey(i.so)) || lineRowsIn.some((r) => !soKey(r.sourceInvoice) && !!soKey(r.sourceSo));
  // The invoices whose dates are checked against the record: those that stand. A Voided one bills nothing, so it can't
  // leave a record billed in NetSuite and unbilled here.
  const dated = [
    ...new Map(invoiceRows.filter((i) => i.invoice && i.date && !isVoidedStatus(i.status)).map((i) => [i.invoice, { invoice: i.invoice, date: i.date! }])).values(),
  ];
  const rows: RowsAbout = { sos: rowSos, invoices: rowInvoices, soOnly: rowSoOnly, dated };
  const picked = pickTarget(key, ctx, invoiceRows, lineRowsIn, rows);
  const empty: BackfillPlan = {
    key,
    wo,
    status: "skip",
    reason: null,
    jobId: null,
    kind: null,
    recordId: null,
    customer: null,
    technician: null,
    seen: null,
    locked: false,
    charges: { current: [], next: null, currentNet: 0, nextNet: null, currentOff: 0, nextDiscount: null, change: false, note: null },
    so: { current: null, next: null, billedOn: null, change: false, note: null },
    invoices: [],
    amounts: { kd: 0, kdSource: "charges", netsuite: 0, corrigo: null, doubleBill: false, nsMismatch: false, corrigoMismatch: false },
    warnings: [],
  };
  if ("reason" in picked) return { ...empty, reason: picked.reason };
  const t: BackfillTicket | null = "ticket" in picked ? picked.ticket : null;
  const rec: BackfillRecord | null = "record" in picked ? picked.record : null;
  const target = (t ?? rec)!;
  const kind: BackfillKind = t ? t.kind : rec!.kind;
  const base: BackfillPlan = {
    ...empty,
    jobId: t ? t.id : null,
    kind,
    recordId: target.id,
    customer: target.customer,
    technician: target.technician,
    seen: target.seen,
    amounts: { ...empty.amounts, kdSource: t ? "charges" : rec!.katzdesk ? "katzdesk" : "netsuite" },
  };
  const what = t ? "ticket" : rec!.kind === "install" ? "install" : "PM";
  if (!target.customer?.trim() || isWalkIn(target.customer)) {
    return { ...base, reason: `The ${what} is on Walk-In, which is never a billing account. Give it the real account first.` };
  }
  const warnings: string[] = picked.warning ? [picked.warning] : [];

  // An install's tickets merged in as billed: their rows are their billing, on the install's card already. Their
  // charge lines stay off the install; their invoices are listed as on the card. One that would change the ticket (an
  // invoice not on it yet, or NetSuite's status since) belongs to the ticket: the WO waits for a run of its own.
  let lineRows = lineRowsIn;
  if (rec) {
    for (const r of invoiceRows) {
      if (!r.invoice) continue;
      const c = carriedBy(rec, r);
      if (!c) continue;
      const before = c.invoices.find((i) => soKey(i.invoice) === soKey(r.invoice));
      const plan = { status: r.status || before?.status || "", total: r.total ?? before?.total ?? null, remaining: r.remaining ?? before?.remaining ?? null, date: r.date ?? before?.date ?? null, so: r.so || null, location: before?.location ?? null };
      if (!before || !SAME_INVOICE(before, plan)) {
        return {
          ...base,
          reason: `${r.invoice} is ticket #${c.jobId}'s billing (merged into install #${rec.id} as billed)${before ? ", and NetSuite has changed it since" : ", and isn't on the ticket yet"}. Put its rows in a file of their own and run that first, so it goes on the ticket; then run the rest.`,
        };
      }
    }
    const kept = lineRows.filter((r) => !carriedBy(rec, { invoice: r.sourceInvoice, so: r.sourceSo }));
    if (kept.length < lineRows.length) {
      const by = [...new Set(lineRows.filter((r) => !kept.includes(r)).map((r) => carriedBy(rec, { invoice: r.sourceInvoice, so: r.sourceSo })!.jobId))];
      warnings.push(`${lineRows.length - kept.length} charge line${lineRows.length - kept.length === 1 ? " is" : "s are"} ticket ${by.map((id) => `#${id}`).join(", ")}'s, billed already and carried over by its merge: left off the install.`);
    }
    lineRows = kept;
  }

  // Locked: a ticket invoiced already in KatzDesk, or merged into an install as billed (10/30). Only invoice records
  // change. An install's or a PM's NetSuite lines and Sales Order are NetSuite's billing as it stands, kept beside its
  // own invoice and never exported: every run that has them refreshes them (11/5 review).
  const locked = t ? t.invoices.some((i) => !isVoidedStatus(i.status)) || !!t.billedOnInstall : false;
  const currentLines: BackfillChargeLine[] = target.lines.map((l) => ({ ...l, kind: kindForItem(l.item) }));
  // Off the lines it comes off: a ticket's Chosen-lines discount, its ticked ones (11/7).
  const current = billTotals(target.lines, target.discount);

  // Charges from the file.
  let next: BackfillChargeLine[] | null = null;
  let nextDiscount: Discount | null = target.discount;
  let chargeNote: string | null = null;
  if (lineRows.length) {
    const built = chargeLinesFromNetSuite(lineRows);
    if (built.problem) {
      chargeNote = `Charges kept: ${built.problem}.`;
      warnings.push(chargeNote);
    } else if (rec && !built.lines.length) {
      // Only a discount, or lines that net to nothing: no charges in the file for this WO (11/5 review).
      chargeNote = `No item lines for ${wo} in the file, only a discount or lines that net to nothing: NetSuite's lines on the ${what} kept.`;
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
  // NetSuite's lines carry no ticks, so they go on as the Whole bill (11/7). A Chosen-lines discount kept from the ticket
  // (a file with no discount for it) goes on as the dollars it took off, so the total stays what it was.
  if (next && nextDiscount?.scope === "chosen") nextDiscount = current.off > 0 ? { kind: "amount", value: current.off } : null;
  const chargesChange = !!next && (!sameLines(next, target.lines) || !sameDiscount(nextDiscount, target.discount));
  const nextNet = next ? applyDiscount(chargesTotal(next), nextDiscount).total : null;

  // Sales Order: the one the charges came from, else the latest live invoice's, else an open SO with no invoice yet.
  // A cancelled SO is never put on a record. An install's carried tickets' rows aren't its own.
  const ownRows = rec ? invoiceRows.filter((i) => !carriedBy(rec, i)) : invoiceRows;
  const sourceRow = ownRows.find((i) => i.chargesSource && i.invoice);
  // A row with no status says nothing about whether the invoice stands: it doesn't count as live (10/28 review).
  const liveRows = ownRows.filter((i) => i.invoice && i.status && !isVoidedStatus(i.status));
  const soOnly = ownRows.filter((i) => !i.invoice && i.so && !/cancel|closed/i.test(i.soStatus));
  const lineSo = lineRows.map((r) => r.sourceSo.toUpperCase().replace(/\s+/g, "")).find(Boolean) ?? null;
  const nextSo =
    sourceRow?.so ||
    lineSo ||
    [...liveRows].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).find((i) => i.so)?.so ||
    soOnly.at(-1)?.so ||
    null;
  // An install's or a PM's: the first it was billed on for this WO, the invoices on it already included (a later file
  // with a later invoice alone doesn't move it).
  const listedHere = new Set(invoiceRows.map((i) => soKey(i.invoice)).filter(Boolean));
  const storedLive = rec ? rec.invoices.filter((i) => i.woKey === key && !listedHere.has(soKey(i.invoice)) && !isVoidedStatus(i.status)) : [];
  const billedOn =
    sourceRow?.date ?? [...liveRows.map((i) => i.date), ...storedLive.map((i) => i.date)].filter((d): d is string => !!d).sort()[0] ?? (rec ? target.billedOn : null);
  const cancelled = ownRows.filter((i) => !i.invoice && i.so && /cancel/i.test(i.soStatus)).map((i) => i.so);
  let soNote: string | null = cancelled.length ? `Cancelled ${cancelled.join(", ")} left off.` : null;
  if (nextSo && target.so && nextSo !== target.so) soNote = [`NetSuite says ${nextSo}; the ${what} has ${target.so}.`, soNote].filter(Boolean).join(" ");
  const soChange = !!nextSo && (nextSo !== (target.so ?? null) || (!!billedOn && billedOn !== target.billedOn));

  // Invoices: new ones, and NetSuite's status, total and remaining on the ones already there. An install's or a PM's
  // are matched across all its WOs: one already on it is refreshed where it is, never added twice (Grok, 11/5).
  const location = (inv: string) => lineRowsIn.find((r) => r.sourceInvoice.toUpperCase().replace(/\s+/g, "") === inv && r.location)?.location ?? null;
  const seen = new Set<string>();
  const invoices: BackfillInvoicePlan[] = [];
  const stored: StoredNsInvoice[] = t ? t.invoices : rec!.invoices;
  for (const r of invoiceRows) {
    if (!r.invoice || seen.has(r.invoice)) continue;
    seen.add(r.invoice);
    const carry = rec ? carriedBy(rec, r) : null;
    if (carry) {
      const was = carry.invoices.find((i) => soKey(i.invoice) === soKey(r.invoice))!;
      invoices.push({
        invoice: r.invoice,
        so: was.so,
        date: was.date,
        status: was.status,
        total: was.total,
        remaining: was.remaining,
        location: was.location,
        source: was.so ? "so" : "standalone",
        change: "elsewhere",
        before: { status: was.status, total: was.total, remaining: was.remaining },
        note: `On the install's card already: ticket #${carry.jobId}'s billing, carried over by its merge. Not counted twice.`,
      });
      continue;
    }
    const before = stored.find((i) => i.invoice.toUpperCase() === r.invoice);
    // NetSuite's status is never made up: a new invoice with no status is left out; one already here keeps its own.
    if (!r.status && !before) {
      warnings.push(`${r.invoice} has no Invoice Status in the file, so it is left out. Export the invoices with their status.`);
      invoices.push({
        invoice: r.invoice,
        so: r.so || null,
        date: r.date,
        status: "",
        total: r.total,
        remaining: r.remaining,
        location: location(r.invoice),
        source: r.so ? "so" : "standalone",
        change: "skip",
        before: null,
        note: "No Invoice Status in the file.",
      });
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
      note: null,
    };
    if (before) plan.change = SAME_INVOICE(before, plan) ? "same" : "updated";
    invoices.push(plan);
    // The same NetSuite invoice on another record already: written here too (or kept), and said, since one of the two is
    // likely wrong (or NetSuite billed both WOs on one invoice).
    {
      const there = (ctx.recordedAt?.get(soKey(r.invoice)) ?? []).filter((x) => !(x.id === target.id && (x.kind === kind || (t && (x.kind === "service" || x.kind === "tlc")))));
      if (there.length) {
        warnings.push(
          `${r.invoice} is on ${there.map((x) => `${x.kind === "install" ? "install" : x.kind === "pm" ? "PM" : "ticket"} #${x.id}`).join(", ")} already. NetSuite billed both on one invoice, or the WO is wrong: check it in NetSuite.`,
        );
      }
    }
  }
  const invoicesChange = invoices.some(writesInvoice);
  const counted = invoices.filter((i) => writesInvoice(i) || i.change === "same");

  // The account NetSuite billed, against the record's.
  const nsCustomer = lineRowsIn.map((r) => r.nsCustomer).find(Boolean);
  if (nsCustomer && nameKey(leafOf(nsCustomer)) !== nameKey(target.customer) && nameKey(nsCustomer) !== nameKey(target.customer)) {
    warnings.push(`NetSuite billed ${nsCustomer}; the ${what}'s account is ${target.customer}.`);
  }
  // Lance bills from San Antonio WH, Bill from Dallas WH.
  for (const loc of new Set([...lineRowsIn.map((r) => r.location), ...counted.map((i) => i.location ?? "")].filter(Boolean))) {
    const w = locationWarning(target.technician, loc);
    if (w) warnings.push(w);
  }

  // Amounts, like for like: what KatzDesk bills after its discount, NetSuite's live invoices (after its header
  // discount; no tax on these), and Corrigo's net (tickets).
  const after = [
    ...stored.filter((i) => !seen.has(i.invoice.toUpperCase())).map((i) => ({ status: i.status, total: i.total })),
    ...counted.map((i) => ({ status: i.status, total: i.total })),
  ];
  const nsCharges = locked || nextNet == null ? current.total : nextNet;
  const kd = t ? nsCharges : (rec!.katzdesk?.net ?? round2(rec!.otherNet + nsCharges));
  // An install or a PM with no lines of its own in KatzDesk and none from NetSuite has nothing to check against.
  const kdSource: BackfillPlan["amounts"]["kdSource"] = t
    ? "charges"
    : rec!.katzdesk
      ? "katzdesk"
      : (next ?? target.lines).length > 0 || !!(next ? nextDiscount : target.discount) || chargesBeyond(rec!, new Set([key]))
        ? "netsuite"
        : "none";
  const netsuite = liveInvoiceTotal(after);
  const corrigo = t ? (invoiceRows.map((i) => i.corrigoNet).find((v): v is number => v != null) ?? t.corrigoNet) : null;
  const hasLive = after.some((i) => !isVoidedStatus(i.status));
  const amounts = {
    kd,
    kdSource,
    netsuite,
    corrigo,
    doubleBill: kdSource !== "none" && possibleDoubleBill(after, kd),
    nsMismatch: kdSource !== "none" && hasLive && Math.abs(netsuite - kd) > CENT,
    corrigoMismatch: corrigo != null && hasLive && Math.abs(corrigo - netsuite) > CENT,
  };
  const amountWarn = amountWarning(amounts, what);
  if (amountWarn) warnings.push(amountWarn);
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
  // A Sales Order that no dated invoice in the file names (an open SO, or charges' SO), or charges with no dated invoice
  // in the file at all: their date can't be checked against the record (WO numbers started over in July 2026).
  if (!locked) {
    const datedSos = new Set(ownRows.filter((i) => i.invoice && i.date).map((i) => soKey(i.so)).filter(Boolean));
    const so = soChange && !!nextSo && soKey(nextSo) !== soKey(target.so) && !datedSos.has(soKey(nextSo));
    const ownDated = rec ? rows.dated.filter((d) => !carriedBy(rec, { invoice: d.invoice })) : rows.dated;
    const lines = chargesChange && !ownDated.length;
    if (so || lines) {
      warnings.push(
        so && lines
          ? `No dated invoice in the file backs ${nextSo} or these charges, so their date can't be checked against the ${what}. WO numbers started over in July 2026: make sure they're this ${what}'s.`
          : so
            ? `No dated invoice in the file backs ${nextSo}, so its date can't be checked against the ${what}. WO numbers started over in July 2026: make sure it's this ${what}'s.`
            : `No dated invoice in the file backs these charges, so their date can't be checked against the ${what}. WO numbers started over in July 2026: make sure they're this ${what}'s.`,
      );
    }
  }
  if (t?.billedOnInstall) {
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
      nextDiscount: locked ? target.discount : nextDiscount,
      change: !locked && chargesChange,
      note: chargeNote,
    },
    so: { current: target.so, next: locked ? target.so : (nextSo ?? target.so), billedOn: locked ? target.billedOn : billedOn, change: !locked && soChange, note: soNote },
    invoices,
    amounts,
    warnings,
  };
}

/**
 * A fingerprint of everything a confirm would write (and the records' updated_at): the write is refused when the plan
 * made again doesn't match the one the Admin looked at. FNV-1a, twice over: a change check, not security.
 */
export function backfillHash(plans: BackfillPlan[]): string {
  const text = JSON.stringify(
    plans.map((p) => [p.key, p.status, p.kind, p.recordId, p.jobId, p.seen, p.charges.next, p.charges.nextDiscount, p.so.change ? [p.so.next, p.so.billedOn] : null, p.invoices]),
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
  const writes = plans.filter((p) => p.status === "write" || p.status === "invoices");
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
    /** The WOs that will write, by what they go on. */
    byKind: {
      service: writes.filter((p) => p.kind === "service").length,
      tlc: writes.filter((p) => p.kind === "tlc").length,
      install: writes.filter((p) => p.kind === "install").length,
      pm: writes.filter((p) => p.kind === "pm").length,
    },
  };
}

/** The history line a backfilled ticket, install or PM gets. */
export function backfillLogLine(p: BackfillPlan): string {
  const parts: string[] = [];
  const record = p.kind === "install" || p.kind === "pm";
  if (p.charges.change && p.charges.next) {
    const sub = chargesTotal(p.charges.next);
    const off = applyDiscount(sub, p.charges.nextDiscount).off;
    parts.push(
      `${record ? `NetSuite charges for ${p.wo}` : "charges"} ${p.charges.next.length} line${p.charges.next.length === 1 ? "" : "s"} ${money(sub)}${off ? `, discount ${money(off)} off, total ${money(round2(sub - off))}` : ""}`,
    );
  }
  if (p.so.change && p.so.next) parts.push(`Sales Order ${p.so.next}${p.so.billedOn ? ` (billed ${p.so.billedOn})` : ""}`);
  const inv = p.invoices.filter(writesInvoice);
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
