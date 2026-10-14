/** Ticket charges (trip, labor, parts) and the billing hand-off. Pure rules — no database, no UI. */

export type ChargeKind = "trip" | "labor" | "part" | "equipment" | "other";

export const CHARGE_KINDS: ChargeKind[] = ["trip", "labor", "part", "equipment", "other"];

export type ChargeLine = {
  item: string;
  description: string;
  qty: number;
  rate: number;
  kind: ChargeKind;
};

/** Where a part's photo and MPN come from: the inventory record. The picker and the invoice line read the same one. */
export type PartRef = {
  id: number;
  sku: string;
  mpn: string | null;
  hasImage: boolean;
  /** Changes when the photo does. */
  imageVersion: string | null;
};

export type BillingItem = {
  item: string;
  description: string | null;
  rate: number | null;
  kind: ChargeKind;
  mfrPart: string | null;
  part?: PartRef | null;
  /** NetSuite Class ("Equipment : Parts and Filters"), when the item list carried one. */
  itemClass?: string | null;
  /** Marked to pull later. Does not change price or stock. */
  getLater?: boolean;
};

/** The two fixed-rate service items. Names match NetSuite exactly. */
export const TRIP_ITEM = "Service : TRIPCHARGE";
export const LABOR_ITEM = "Service : SERVICELABOR";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineAmount(l: Pick<ChargeLine, "qty" | "rate">): number {
  return round2(l.qty * l.rate);
}

export function chargesTotal(lines: Pick<ChargeLine, "qty" | "rate">[]): number {
  return round2(lines.reduce((sum, l) => sum + lineAmount(l), 0));
}

/** Positive quantity, up to two decimals. Anything else is null. */
export function cleanQty(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0 || n > 100000) return null;
  return round2(n);
}

/** Money: zero or more, up to two decimals. A leading $ and thousands commas are fine. */
export function cleanRate(raw: unknown): number | null {
  const s = typeof raw === "number" ? String(raw) : String(raw ?? "").replace(/[$,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) return null;
  return round2(n);
}

/** The SKU part of a "CATEGORY : SKU" NetSuite item name. A name without a category is returned whole. */
export function itemSku(item: string): string {
  const i = item.lastIndexOf(" : ");
  return (i >= 0 ? item.slice(i + 3) : item).trim();
}

export function kindForItem(item: string): ChargeKind {
  const name = item.trim().toUpperCase();
  const sku = itemSku(item).toUpperCase();
  if (name === TRIP_ITEM.toUpperCase() || sku === "TRIPCHARGE") return "trip";
  if (name === LABOR_ITEM.toUpperCase() || sku === "SERVICELABOR") return "labor";
  if (/^EQUIPMENT\s*:/.test(name)) return "equipment";
  return "part";
}

export function normalizePartNo(raw: string | null | undefined): string {
  return String(raw ?? "").toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

/**
 * Find NetSuite items for something typed on a ticket: a NetSuite SKU, a manufacturer number or words from
 * the description. Exact number matches come first. Never guesses between look-alikes — returns a short list.
 */
export function searchItems<T extends Pick<BillingItem, "item" | "description" | "mfrPart">>(
  query: string,
  items: T[],
  limit = 12,
): T[] {
  const q = query.trim();
  if (!q) return [];
  const nq = normalizePartNo(q);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored: { item: T; score: number }[] = [];
  for (const it of items) {
    const sku = normalizePartNo(itemSku(it.item));
    const mfr = normalizePartNo(it.mfrPart);
    const name = it.item.toLowerCase();
    const desc = (it.description ?? "").toLowerCase();
    let score = 0;
    if (nq && (sku === nq || mfr === nq)) score = 100;
    else if (nq.length >= 3 && (sku.startsWith(nq) || mfr.startsWith(nq))) score = 60;
    else if (words.every((w) => name.includes(w) || desc.includes(w))) score = 30;
    if (score) scored.push({ item: it, score });
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.item.localeCompare(b.item.item))
    .slice(0, limit)
    .map((s) => s.item);
}

export type ChargeProblem = { index: number; message: string };

/** What must be fixed before the lines are saved. Nothing here changes the lines. */
export function checkCharges(lines: { item: string; qty: unknown; rate: unknown }[]): ChargeProblem[] {
  const out: ChargeProblem[] = [];
  lines.forEach((l, index) => {
    if (!String(l.item ?? "").trim()) out.push({ index, message: "Pick an item." });
    if (cleanQty(l.qty) == null) out.push({ index, message: "Quantity must be more than zero." });
    if (cleanRate(l.rate) == null) out.push({ index, message: "Rate must be zero or more." });
  });
  return out;
}

export type BillingState = "billed" | "ready" | "no-charges";

export const BILLING_LABEL: Record<BillingState, string> = {
  billed: "Billed",
  ready: "Ready To Bill",
  "no-charges": "No Charges",
};

/**
 * Where a ticket is in billing. A Sales Order number means it is billed. Charges without one are ready.
 * No charges is flagged on purpose: a finished ticket with nothing on it is usually a missed bill.
 */
export function billingState(input: { lineCount: number; nsSo: string | null | undefined }): BillingState {
  if ((input.nsSo ?? "").trim()) return "billed";
  return input.lineCount > 0 ? "ready" : "no-charges";
}

/** Sales Order numbers look like SO4345. Kept as typed, only trimmed and upper-cased. */
export function cleanSalesOrder(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim().toUpperCase().replace(/\s+/g, "");
  return s || null;
}

// ---- NetSuite item list / price import -----------------------------------------------------------------

export type ItemImportRow = {
  line: number;
  sheet: string;
  /** Bare SKU as the item export lists it, e.g. EVER104120. This is what rows are matched on. */
  sku: string;
  /** NetSuite parent group when the file says so ("PARTS"), else null. */
  parent: string | null;
  /** How the item reads on a Sales Order: "PARTS : EVER104120", or the bare SKU when no parent is known. */
  item: string;
  description: string | null;
  rate: number | null;
  cost: number | null;
  kind: ChargeKind;
  mfrPart: string | null;
  /** From an Inactive column: false when marked inactive. Null when the file has no such column or cell. */
  active: boolean | null;
};

/** Which columns the file actually has. A column that is absent, or a blank cell, never changes what is stored. */
export type ItemImportColumns = {
  description: boolean;
  rate: boolean;
  cost: boolean;
  parent: boolean;
  mfrPart: boolean;
  inactive: boolean;
  /** A Class column: the only thing that lets an import say what kind an existing item is. */
  cls: boolean;
};

type ItemField = "name" | "description" | "rate" | "cost" | "parent" | "mfrPart" | "inactive" | "class";

const ITEM_HEADERS: Record<string, ItemField> = {
  name: "name",
  item: "name",
  "item name": "name",
  "item name number": "name",
  "item number": "name",
  sku: "name",
  "part number": "name",
  description: "description",
  "sales description": "description",
  "base price": "rate",
  "sell price": "rate",
  "unit price": "rate",
  price: "rate",
  rate: "rate",
  "purchase price": "cost",
  "unit cost": "cost",
  cost: "cost",
  parent: "parent",
  "parent item": "parent",
  category: "parent",
  group: "parent",
  "mfr part": "mfrPart",
  "mfr part number": "mfrPart",
  "manufacturer part number": "mfrPart",
  mpn: "mfrPart",
  "vendor name code": "mfrPart",
  "vendor code": "mfrPart",
  inactive: "inactive",
  class: "class",
};

function headerKey(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "PARTS : EVER104120" -> parent PARTS, sku EVER104120. A plain SKU has no parent. */
export function splitItemName(name: string): { parent: string | null; sku: string } {
  const i = name.lastIndexOf(" : ");
  if (i < 0) return { parent: null, sku: name.trim() };
  return { parent: name.slice(0, i).trim() || null, sku: name.slice(i + 3).trim() };
}

export function itemFullName(sku: string, parent: string | null | undefined): string {
  const p = (parent ?? "").trim();
  return p ? p + " : " + sku : sku;
}

/** Kind from the NetSuite class when the file has one, else from the name. */
export function kindFromClass(cls: string | null | undefined, name: string): ChargeKind {
  const named = kindForItem(name);
  if (named === "trip" || named === "labor") return named;
  const c = String(cls ?? "").trim().toLowerCase();
  if (!c) return named;
  if (/^service\b/.test(c)) return "other";
  if (/equipment\s*:\s*equipment sales|^equipment sales/.test(c)) return "equipment";
  if (/parts|filters/.test(c)) return "part";
  return named;
}

function yes(v: unknown): boolean | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["yes", "y", "true", "t", "1", "x"].includes(s)) return true;
  if (["no", "n", "false", "f", "0"].includes(s)) return false;
  return null;
}

export type ItemSheetsResult = {
  rows: ItemImportRow[];
  /** Rows with no name, or a SKU already seen earlier in the file. */
  skipped: number;
  /** Sheets that had no Name column and were left out. */
  ignoredSheets: string[];
  columns: ItemImportColumns;
};

/** Rows from the sheets of a NetSuite item export (or a price list): every sheet that has a Name column is read. */
export function itemRowsFromSheets(sheets: { name: string; matrix: unknown[][] }[]): ItemSheetsResult {
  const rows: ItemImportRow[] = [];
  const ignoredSheets: string[] = [];
  const columns: ItemImportColumns = { description: false, rate: false, cost: false, parent: false, mfrPart: false, inactive: false, cls: false };
  const seen = new Set<string>();
  let skipped = 0;
  let readable = 0;

  for (const sheet of sheets) {
    let head = -1;
    let cols: Partial<Record<ItemField, number>> = {};
    for (let i = 0; i < Math.min(sheet.matrix.length, 5); i++) {
      const found: typeof cols = {};
      (sheet.matrix[i] ?? []).forEach((c, idx) => {
        const key = ITEM_HEADERS[headerKey(c)];
        if (key && found[key] == null) found[key] = idx;
      });
      if (found.name != null) {
        head = i;
        cols = found;
        break;
      }
    }
    if (head < 0) {
      if (sheet.matrix.some((r) => r.some((c) => String(c ?? "").trim()))) ignoredSheets.push(sheet.name);
      continue;
    }
    readable += 1;
    if (cols.description != null) columns.description = true;
    if (cols.rate != null) columns.rate = true;
    if (cols.cost != null) columns.cost = true;
    if (cols.parent != null) columns.parent = true;
    if (cols.mfrPart != null) columns.mfrPart = true;
    if (cols.inactive != null) columns.inactive = true;
    if (cols.class != null) columns.cls = true;

    for (let i = head + 1; i < sheet.matrix.length; i++) {
      const r = sheet.matrix[i] ?? [];
      if (r.every((c) => !String(c ?? "").trim())) continue;
      const raw = String(r[cols.name!] ?? "").trim();
      if (!raw) {
        skipped += 1;
        continue;
      }
      const split = splitItemName(raw);
      const parentCell = cols.parent != null ? String(r[cols.parent] ?? "").trim() : "";
      const parent = parentCell || split.parent;
      const key = split.sku.toLowerCase();
      if (!split.sku || seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      const cell = (f: ItemField) => (cols[f] != null ? String(r[cols[f]!] ?? "").trim() : "");
      const rateRaw = cell("rate");
      const costRaw = cell("cost");
      const inactive = cols.inactive != null ? yes(r[cols.inactive]) : null;
      rows.push({
        line: i + 1,
        sheet: sheet.name,
        sku: split.sku,
        parent,
        item: itemFullName(split.sku, parent),
        description: cell("description") || null,
        rate: rateRaw ? cleanRate(rateRaw) : null,
        cost: costRaw ? cleanRate(costRaw) : null,
        kind: kindFromClass(cell("class"), raw),
        mfrPart: cell("mfrPart") || null,
        active: inactive == null ? null : !inactive,
      });
    }
  }
  if (!readable) {
    throw new Error("Could not find a Name column. The first row needs a header like Name, Description, Base Price.");
  }
  return { rows, skipped, ignoredSheets, columns };
}

/** One sheet. Kept for callers and tests that have a single matrix. */
export function itemRowsFromMatrix(matrix: unknown[][]): { rows: ItemImportRow[]; skipped: number } {
  const r = itemRowsFromSheets([{ name: "Sheet1", matrix }]);
  return { rows: r.rows, skipped: r.skipped };
}

export type PriceChange = {
  from: number | null;
  to: number;
  /** Percent change from the old price, or null when there was none to compare with. */
  pct: number | null;
  /** A swing this large is more often a typo than a price move; shown for a second look, not blocked. */
  check: boolean;
};

export const PRICE_CHECK_PCT = 50;

export function priceChange(from: number | null, to: number | null): PriceChange | null {
  if (to == null) return null;
  if (from != null && from === to) return null;
  const pct = from != null && from > 0 ? round2(((to - from) / from) * 100) : null;
  return { from, to, pct, check: pct != null && Math.abs(pct) >= PRICE_CHECK_PCT };
}

// ---- Billing hand-off CSV ------------------------------------------------------------------------------

export type BillingExportLine = {
  wo: string;
  po: string;
  customer: string;
  accountNumber: string;
  netsuiteId: string;
  technician: string;
  completed: string;
  item: string;
  description: string;
  qty: number;
  rate: number;
  workDone: string;
};

export const BILLING_CSV_HEADER = [
  "WO",
  "PO",
  "Customer",
  "Account Number",
  "NetSuite ID",
  "Technician",
  "Completed",
  "Item",
  "SKU",
  "Description",
  "Qty",
  "Rate",
  "Amount",
  "Work Done",
];

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  // A cell starting with = + - @ can run as a formula when the file is opened in a spreadsheet.
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One row per charge line, in the order the lines sit on the ticket. */
export function billingCsv(lines: BillingExportLine[]): string {
  const out = [BILLING_CSV_HEADER.map(csvCell).join(",")];
  for (const l of lines) {
    out.push(
      [
        l.wo,
        l.po,
        l.customer,
        l.accountNumber,
        l.netsuiteId,
        l.technician,
        l.completed,
        l.item,
        itemSku(l.item),
        l.description,
        l.qty,
        l.rate.toFixed(2),
        lineAmount(l).toFixed(2),
        l.workDone,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return out.join("\r\n") + "\r\n";
}
