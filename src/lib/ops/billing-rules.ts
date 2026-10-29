/**
 * Billing rules shared by the ticket, the Invoices page, the exports and the Billing Backfill (Grok's request through
 * Chuy, 2026-10-28):
 * - an invoice's status is NetSuite's own word, never worked out from what is still owed;
 * - a ticket with an invoice that isn't Voided is locked (charges, P.O., discount, Sales Order);
 * - two or more live invoices adding up to more than the charges is a possible double bill;
 * - Lance bills from San Antonio WH, Bill from Dallas WH;
 * - the discount is NetSuite's header discount: item CLDSERVICE at minus the dollars, never a discount line.
 *
 * Pure: no server imports, safe for node --test.
 */
import { csvCell, round2 } from "./charges.ts";
import { applyDiscount, HEADER_DISCOUNT_ITEM, type Discount } from "./discount.ts";
import { canonicalTechName, sameTech } from "./tech-match.ts";

// ── Invoice status ───────────────────────────────────────────────────────────────────────────────────────────────────

export type InvoiceStatusKey = "open" | "paid" | "voided" | "other";

export const INVOICE_STATUS_KEYS: InvoiceStatusKey[] = ["open", "paid", "voided", "other"];

export const INVOICE_STATUS_LABEL: Record<InvoiceStatusKey, string> = {
  open: "Open",
  paid: "Paid",
  voided: "Voided",
  other: "Other",
};

/** NetSuite's status as one of four: "Paid In Full" is Paid, "Void" is Voided. Never read from amount remaining. */
export function invoiceStatusKey(raw: string | null | undefined): InvoiceStatusKey {
  const s = String(raw ?? "").toLowerCase().replace(/[^a-z]+/g, "");
  if (s === "open") return "open";
  if (s === "paid" || s === "paidinfull") return "paid";
  if (s === "voided" || s === "void") return "voided";
  return "other";
}

export const isVoidedStatus = (raw: string | null | undefined) => invoiceStatusKey(raw) === "voided";

/** "(no invoice yet)" and blanks: a Sales Order row with no invoice behind it. */
export function noInvoiceYet(invoice: string | null | undefined, status: string | null | undefined): boolean {
  return !String(invoice ?? "").trim() || /no\s*invoice/i.test(String(status ?? ""));
}

// ── One ticket's invoices ────────────────────────────────────────────────────────────────────────────────────────────

export type InvoiceLite = {
  invoice: string;
  so: string | null;
  date: string | null;
  status: string;
  total: number | null;
  remaining: number | null;
  source?: "so" | "standalone";
  location?: string | null;
};

/** SQL: true when the ticket (by its id column) has a NetSuite invoice that isn't Voided (it is locked). */
export const LIVE_INVOICE_SQL = (jobCol: string) =>
  `exists (select 1 from ticket_invoices ti_live
            where ti_live.job_id = ${jobCol}
              and lower(regexp_replace(ti_live.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void'))`;

/** Invoices that aren't Voided: they lock the ticket and count toward what NetSuite billed. */
export function liveInvoices<T extends Pick<InvoiceLite, "status">>(invoices: T[]): T[] {
  return invoices.filter((i) => !isVoidedStatus(i.status));
}

/** What NetSuite billed: the live invoices' totals added up. */
export function liveInvoiceTotal(invoices: Pick<InvoiceLite, "status" | "total">[]): number {
  return round2(liveInvoices(invoices).reduce((sum, i) => sum + (i.total ?? 0), 0));
}

/** A cent either way is the same amount. */
const CENT = 0.005;

/** Two or more live invoices whose totals add up to more than the ticket's charges (after its discount). */
export function possibleDoubleBill(invoices: Pick<InvoiceLite, "status" | "total">[], chargeNet: number): boolean {
  return liveInvoices(invoices).length >= 2 && liveInvoiceTotal(invoices) > round2(chargeNet) + CENT;
}

/** NetSuite's live invoices don't add up to the ticket's charges (after its discount). No live invoice: nothing to compare. */
export function chargesMismatch(invoices: Pick<InvoiceLite, "status" | "total">[], chargeNet: number): boolean {
  return liveInvoices(invoices).length > 0 && Math.abs(liveInvoiceTotal(invoices) - round2(chargeNet)) > CENT;
}

/** The invoice that locks the ticket: the latest live one (by date, then number), or null. */
export function lockingInvoice<T extends Pick<InvoiceLite, "invoice" | "status" | "date">>(invoices: T[]): T | null {
  const live = liveInvoices(invoices);
  if (!live.length) return null;
  return [...live].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.invoice.localeCompare(a.invoice))[0]!;
}

export function lockMessage(by: Pick<InvoiceLite, "invoice" | "status"> | null): string | null {
  return by ? `Invoiced on ${by.invoice} (${by.status}). Charges, P.O., discount and Sales Order are locked.` : null;
}

// ── Unlock ───────────────────────────────────────────────────────────────────────────────────────────────────────────

/** An Admin's unlock lasts this long; saving locks the ticket again sooner. */
export const UNLOCK_MINUTES = 60;

export function unlockActive(unlockedAt: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!unlockedAt) return false;
  const t = unlockedAt instanceof Date ? unlockedAt.getTime() : Date.parse(String(unlockedAt));
  if (!Number.isFinite(t)) return false;
  return now.getTime() - t < UNLOCK_MINUTES * 60_000 && t <= now.getTime() + 60_000;
}

/** The reason an Admin types to unlock: required, one line, at most 300 characters. */
export function cleanUnlockReason(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").replace(/\s+/g, " ").trim();
  return s.length >= 3 ? s.slice(0, 300) : null;
}

// ── Warehouse (location) rule ────────────────────────────────────────────────────────────────────────────────────────

/** The techs whose tickets are billed from a set warehouse. */
export const WAREHOUSE_RULES: { tech: string; location: string }[] = [
  { tech: "Lance Oden", location: "San Antonio WH" },
  { tech: "Bill McKinley", location: "Dallas WH" },
];

/** "Houston - WH", "Houston WH" and "houston wh" are one location. */
export const locationKey = (raw: string | null | undefined) => String(raw ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** The warehouse a tech's tickets are billed from, or null (no rule). */
export function warehouseForTech(tech: string | null | undefined): string | null {
  if (!String(tech ?? "").trim()) return null;
  return WAREHOUSE_RULES.find((r) => sameTech(r.tech, tech) || canonicalTechName(tech) === r.tech)?.location ?? null;
}

/** A warning when a ticket's NetSuite location breaks the rule ("Lance Oden bills from San Antonio WH, not Houston - WH"). */
export function locationWarning(tech: string | null | undefined, location: string | null | undefined): string | null {
  const expected = warehouseForTech(tech);
  const loc = String(location ?? "").trim();
  if (!expected || !loc || locationKey(loc) === locationKey(expected)) return null;
  const who = WAREHOUSE_RULES.find((r) => r.location === expected)!.tech;
  return `${who} bills from ${expected}, not ${loc}`;
}

// ── ServiceChannel id ────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * A ServiceChannel store id at the end of a Corrigo name: "Zz Cafe - Katy BRSO-TX901" or "… (BRSO-TX901)".
 * Only BRSO-TX### is used, and only at the very end: a looser pattern would eat part numbers (AMS-QT10, KATZ-IT).
 */
export const SERVICE_CHANNEL_ID = /\s*[-–]?\s*\(?\bBRSO-TX\d{3}\)?\s*$/i;

export function stripServiceChannelId(name: string | null | undefined): string {
  const s = String(name ?? "").trim();
  const out = s.replace(SERVICE_CHANNEL_ID, "").trim();
  return out || s;
}

// ── Header discount ──────────────────────────────────────────────────────────────────────────────────────────────────

/** NetSuite's header discount item (CLDSERVICE). */
export const NS_DISCOUNT_ITEM = HEADER_DISCOUNT_ITEM;

/** NetSuite discount item names that are a discount, never a charge line. */
export const NS_DISCOUNT_ITEMS = new Set(["cldservice", "cld", "discount"]);

export function isDiscountItem(item: string | null | undefined, itemType?: string | null): boolean {
  const name = String(item ?? "").trim().toLowerCase();
  const sku = name.includes(" : ") ? name.slice(name.lastIndexOf(" : ") + 3).trim() : name;
  return NS_DISCOUNT_ITEMS.has(name) || NS_DISCOUNT_ITEMS.has(sku) || /^discount$/i.test(String(itemType ?? "").trim());
}

/** A ticket's discount as NetSuite's header discount: the dollars off (a percent is turned into dollars). */
export function headerDiscount(subtotal: number, discount: Discount | null | undefined): { item: string; rate: string; off: number } | null {
  const { off } = applyDiscount(subtotal, discount);
  return off > 0 ? { item: NS_DISCOUNT_ITEM, rate: (-off).toFixed(2), off } : null;
}

/**
 * NetSuite's header discount in dollars, from a record's lines, its discount (stored with either sign) and its total
 * after the discount. The lines and the total decide; the discount cell only has to agree with them.
 */
export function discountFromNetSuite(
  linesTotal: number,
  discountAmount: number | null,
  recordTotal: number | null,
): { dollars: number; note: string | null } {
  const lines = round2(linesTotal);
  if (recordTotal == null) {
    const d = discountAmount == null ? 0 : round2(Math.abs(discountAmount));
    return { dollars: d, note: null };
  }
  const d = round2(lines - recordTotal);
  if (d < -CENT) return { dollars: 0, note: `NetSuite's total ${recordTotal.toFixed(2)} is more than its lines ${lines.toFixed(2)}` };
  const dollars = d > CENT ? d : 0;
  if (discountAmount != null && Math.abs(Math.abs(discountAmount) - dollars) > 0.011) {
    return { dollars, note: `NetSuite's discount ${discountAmount.toFixed(2)} doesn't match lines ${lines.toFixed(2)} − total ${recordTotal.toFixed(2)}` };
  }
  return { dollars, note: null };
}

// ── Filters (Tickets list, Invoices page, Tickets in window) ─────────────────────────────────────────────────────────

export type DateBy = "received" | "completed" | "invoiced";
export type YesNo = "yes" | "no";
export type BoardKey = "service" | "tlc" | "pm" | "install";

export const BOARD_LABEL: Record<BoardKey, string> = {
  service: "Tickets",
  tlc: "TLC + Factor",
  pm: "PMs",
  install: "Installs",
};

export type BillingFilters = {
  q?: string;
  dateBy?: DateBy;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
  board?: BoardKey;
  account?: string;
  tech?: string;
  so?: YesNo;
  invoice?: YesNo;
  invStatus?: InvoiceStatusKey;
  double?: boolean;
  mismatch?: boolean;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const text = (v: unknown, max = 120) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined);
const flag = (v: unknown) => v === true || v === "1" || v === 1 || v === "true" || undefined;
const pick = <T extends string>(v: unknown, allowed: readonly T[]) => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : undefined);

/** Filters from the address bar: anything unknown or malformed is dropped. */
export function parseBillingFilters(s: Record<string, unknown>): BillingFilters {
  const out: BillingFilters = {
    q: text(s.q),
    dateBy: pick(s.dateBy, ["received", "completed", "invoiced"] as const),
    dateFrom: typeof s.dateFrom === "string" && DAY.test(s.dateFrom) ? s.dateFrom : undefined,
    dateTo: typeof s.dateTo === "string" && DAY.test(s.dateTo) ? s.dateTo : undefined,
    status: text(s.status, 60),
    board: pick(s.board, ["service", "tlc", "pm", "install"] as const),
    account: text(s.account, 200),
    tech: text(s.tech, 80),
    so: pick(s.so, ["yes", "no"] as const),
    invoice: pick(s.invoice, ["yes", "no"] as const),
    invStatus: pick(s.invStatus, INVOICE_STATUS_KEYS),
    double: flag(s.double),
    mismatch: flag(s.mismatch),
  };
  return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined)) as BillingFilters;
}

/** How many filters are on (search and the date field picker don't count). */
export function activeFilterCount(f: BillingFilters): number {
  return (
    (f.dateFrom || f.dateTo ? 1 : 0) +
    [f.status, f.board, f.account, f.tech, f.so, f.invoice, f.invStatus, f.double, f.mismatch].filter(Boolean).length
  );
}

/** What one row offers the filters. Dates are YYYY-MM-DD. */
export type FilterRow = {
  board: BoardKey;
  status: string;
  account: string | null;
  techs: (string | null | undefined)[];
  received: string | null;
  completed: string | null;
  /** Live invoice dates, else the Sales Order's billed date. */
  invoiced: string[];
  so: string | null;
  invoiceStatuses: string[];
  doubleBill: boolean;
  mismatch: boolean;
  /** Words the search box looks in. */
  words: (string | null | undefined)[];
};

const inRange = (d: string | null | undefined, from?: string, to?: string) => !!d && (!from || d >= from) && (!to || d <= to);

export function matchesBillingFilters(row: FilterRow, f: BillingFilters): boolean {
  if (f.board && row.board !== f.board) return false;
  if (f.status && row.status.trim().toLowerCase() !== f.status.trim().toLowerCase()) return false;
  if (f.account && !(row.account ?? "").toLowerCase().includes(f.account.toLowerCase())) return false;
  if (f.tech && !row.techs.some((t) => sameTech(t, f.tech))) return false;
  if (f.so === "yes" && !row.so?.trim()) return false;
  if (f.so === "no" && row.so?.trim()) return false;
  // Invoiced means an invoice that stands: a ticket whose only invoice is Voided isn't billed (10/28 review).
  const invoiced = row.invoiceStatuses.some((s) => invoiceStatusKey(s) !== "voided");
  if (f.invoice === "yes" && !invoiced) return false;
  if (f.invoice === "no" && invoiced) return false;
  if (f.invStatus && !row.invoiceStatuses.some((s) => invoiceStatusKey(s) === f.invStatus)) return false;
  if (f.double && !row.doubleBill) return false;
  if (f.mismatch && !row.mismatch) return false;
  if (f.dateFrom || f.dateTo) {
    const by = f.dateBy ?? "completed";
    const ok =
      by === "received"
        ? inRange(row.received, f.dateFrom, f.dateTo)
        : by === "completed"
          ? inRange(row.completed, f.dateFrom, f.dateTo)
          : row.invoiced.some((d) => inRange(d, f.dateFrom, f.dateTo));
    if (!ok) return false;
  }
  const needle = (f.q ?? "").trim().toLowerCase();
  if (needle && !row.words.some((w) => String(w ?? "").toLowerCase().includes(needle))) return false;
  return true;
}

/** Search params with the blanks left out, so the address bar only carries what is set. */
export function filtersToSearch(f: BillingFilters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(f)) {
    if (v === undefined || v === false || v === "") continue;
    out[k] = v === true ? "1" : String(v);
  }
  return out;
}

// ── CSV ──────────────────────────────────────────────────────────────────────────────────────────────────────────────

/** One CSV from a header and rows (spreadsheet-safe cells, CRLF lines). */
export function toCsv(columns: string[], rows: (string | number | null | undefined)[][]): string {
  const line = (cells: (string | number | null | undefined)[]) => cells.map((c) => csvCell(c ?? "")).join(",");
  return [line(columns), ...rows.map(line)].join("\r\n") + "\r\n";
}

export const moneyText = (n: number | null | undefined) => (n == null ? "" : n.toFixed(2));
