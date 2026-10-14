/**
 * Parts by MPN: the NetSuite parts import, the part pricing file, Our Discount Rule, and cost / sell / discount /
 * margin on an invoiced part. Both imports are planned first and only written after Approve.
 * Pure: no server imports, safe for node --test.
 */
import { cleanRate, itemFullName, kindFromClass, normalizePartNo, round2, splitItemName, type ChargeKind } from "./charges.ts";

/** One MPN = one part: case, spaces and dashes never make a second one. */
export const mpnKey = (raw: string | null | undefined): string => normalizePartNo(raw);

function headerKey(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9#]+/g, " ")
    .trim();
}

/** The first row (of the top five) that holds the needed columns, with each known column's index. */
function findHeader<F extends string>(matrix: unknown[][], names: Record<string, F>, needed: F[]): { head: number; cols: Partial<Record<F, number>> } | null {
  for (let i = 0; i < Math.min(matrix.length, 5); i++) {
    const cols: Partial<Record<F, number>> = {};
    (matrix[i] ?? []).forEach((c, idx) => {
      const key = names[headerKey(c)];
      if (key && cols[key] == null) cols[key] = idx;
    });
    if (needed.every((n) => cols[n] != null)) return { head: i, cols };
  }
  return null;
}

const blankRow = (r: unknown[]) => r.every((c) => !String(c ?? "").trim());

// ------------------------------------------------------------------------------------------ parts import

type PartField = "mpn" | "name" | "description" | "displayName" | "rate" | "cost" | "parent" | "class" | "inactive";

const PART_HEADERS: Record<string, PartField> = {
  mpn: "mpn",
  "mfr part": "mpn",
  "mfr part number": "mpn",
  "mfr part #": "mpn",
  "manufacturer part number": "mpn",
  "manufacturer part": "mpn",
  "vendor name code": "mpn",
  "vendor code": "mpn",
  "vendor part number": "mpn",
  name: "name",
  item: "name",
  "item name": "name",
  "item name number": "name",
  "item number": "name",
  sku: "name",
  description: "description",
  "sales description": "description",
  // Only used when the file has no Description column: "Display Name" is often blank in a NetSuite export.
  "display name": "displayName",
  "base price": "rate",
  "sell price": "rate",
  "sales price": "rate",
  price: "rate",
  rate: "rate",
  "purchase price": "cost",
  "unit cost": "cost",
  cost: "cost",
  parent: "parent",
  "parent item": "parent",
  class: "class",
  inactive: "inactive",
};

/** The only classes kept on the parts list. Anything else on a file is not added and is moved off the active list. */
export const PART_CLASSES = ["Parts", "Water Filters", "Service", "Equipment", "Dispensers"] as const;
export type PartClass = (typeof PART_CLASSES)[number];
export const isPartClass = (v: unknown): v is PartClass => (PART_CLASSES as readonly string[]).includes(String(v));

const SHEET_CLASS: Record<string, PartClass> = {
  parts: "Parts",
  filters: "Water Filters",
  "water filters": "Water Filters",
  service: "Service",
  services: "Service",
  equipment: "Equipment",
  dispensers: "Dispensers",
};
const classKey = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const CLASS_BY_NAME = new Map<string, PartClass>(PART_CLASSES.map((c) => [classKey(c), c]));

/**
 * Which of the five classes a row belongs to. The NetSuite export keeps one tab per class (Parts, Filters,
 * Equipment, Service) and its Class column is a path ("Equipment : Parts and Filters"), so a tab named for a class
 * decides it. Any other tab: the Class column's own name, its first or last part ("Service : Catering" is Service).
 * null means the row is in none of the five.
 */
export function partClassFor(rawClass: string, sheetName: string): PartClass | null {
  const bySheet = SHEET_CLASS[classKey(sheetName)];
  if (bySheet) return bySheet;
  const parts = rawClass.split(":").map(classKey).filter(Boolean);
  for (const k of [classKey(rawClass), parts[0], parts[parts.length - 1]]) {
    const hit = k ? CLASS_BY_NAME.get(k) : undefined;
    if (hit) return hit;
  }
  if (/water filter/.test(classKey(rawClass))) return "Water Filters";
  return null;
}

export type PartImportRow = {
  line: number;
  sheet: string;
  mpn: string;
  /** The NetSuite SKU, when the file has a Name column. */
  sku: string | null;
  parent: string | null;
  description: string | null;
  rate: number | null;
  cost: number | null;
  kind: ChargeKind;
  /** One of the five classes, or null when the file has none. */
  cls: PartClass | null;
  /** The NetSuite Class as the file has it ("Equipment : Parts and Filters"), kept as read. */
  sourceClass: string | null;
  /** False when the file gives a class that is not one of the five: the row is not added. */
  keep: boolean;
  /** From an Inactive column: false when marked inactive; null when the file has no such column. */
  active: boolean | null;
};

export type PartFileRead = {
  rows: PartImportRow[];
  skipped: number;
  duplicates: number;
  columns: { name: boolean; description: boolean; rate: boolean; cost: boolean; cls: boolean };
  /** True when the file has no MPN column and its Name column is the part number (NetSuite item export). */
  nameIsMpn: boolean;
};

function yesNo(v: unknown): boolean | null {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  if (["yes", "y", "true", "t", "1", "x"].includes(s)) return true;
  if (["no", "n", "false", "f", "0"].includes(s)) return false;
  return null;
}

/**
 * Rows of a NetSuite parts export. The part number (MPN) is required: an MPN column, or, when the file has none,
 * the Name column (a NetSuite item export, where Name is the part number and Description is the part name).
 * The same MPN twice in the file keeps the first. Every sheet with the columns is read.
 */
export function partRowsFromSheets(sheets: { name: string; matrix: unknown[][] }[]): PartFileRead {
  const rows: PartImportRow[] = [];
  const seen = new Set<string>();
  const columns = { name: false, description: false, rate: false, cost: false, cls: false };
  let skipped = 0;
  let duplicates = 0;
  let readable = 0;
  let nameIsMpn = false;
  for (const sheet of sheets) {
    let found = findHeader(sheet.matrix, PART_HEADERS, ["mpn"]);
    let fromName = false;
    if (!found) {
      found = findHeader(sheet.matrix, PART_HEADERS, ["name"]);
      fromName = !!found;
    }
    if (!found) continue;
    readable += 1;
    if (fromName) nameIsMpn = true;
    const { head, cols } = found;
    if (cols.name != null) columns.name = true;
    if (cols.description != null || cols.displayName != null) columns.description = true;
    if (cols.rate != null) columns.rate = true;
    if (cols.cost != null) columns.cost = true;
    if (cols.class != null) columns.cls = true;
    const cell = (r: unknown[], f: PartField) => (cols[f] != null ? String(r[cols[f]!] ?? "").trim() : "");
    for (let i = head + 1; i < sheet.matrix.length; i++) {
      const r = sheet.matrix[i] ?? [];
      if (blankRow(r)) continue;
      const mpn = (fromName ? cell(r, "name") : cell(r, "mpn")).replace(/\s+/g, " ");
      const key = mpnKey(mpn);
      if (!key) {
        skipped += 1;
        continue;
      }
      if (seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);
      const rawName = cell(r, "name");
      // Name is the part number: it is also the NetSuite item name, so it is the SKU as it stands.
      const split = rawName && !fromName ? splitItemName(rawName) : null;
      const parent = cell(r, "parent") || split?.parent || null;
      const rate = cell(r, "rate");
      const cost = cell(r, "cost");
      const cls = cell(r, "class").replace(/\s+/g, " ");
      const bucket = partClassFor(cls, sheet.name);
      // No class anywhere (a plain list of part numbers) is kept as it is; a class outside the five is not.
      const keep = bucket != null || (!cls && !SHEET_CLASS[classKey(sheet.name)]);
      const inactive = cols.inactive != null ? yesNo(r[cols.inactive]) : null;
      rows.push({
        line: i + 1,
        sheet: sheet.name,
        mpn,
        sku: fromName ? mpn : split?.sku || null,
        parent,
        description: (cols.description != null ? cell(r, "description") : cell(r, "displayName")) || null,
        rate: rate ? cleanRate(rate) : null,
        cost: cost ? cleanRate(cost) : null,
        kind: kindFromClass(cls, rawName || mpn),
        cls: bucket,
        sourceClass: cls || null,
        keep,
        active: inactive == null ? null : !inactive,
      });
    }
  }
  if (!readable) throw new Error("Could not find an MPN or Name column. The first row needs a header like Name (or MPN), Description, Class, Base Price.");
  return { rows, skipped, duplicates, columns, nameIsMpn };
}

export type StoredPart = {
  id: number;
  sku: string;
  item: string;
  mpn: string | null;
  description: string | null;
  rate: number | null;
  cost: number | null;
  listPrice: number | null;
  /** Set when the part was hidden. Imports skip it and never clear the hide. */
  hidden?: boolean;
  itemClass?: string | null;
  active?: boolean;
};

export type PartPlanStatus = "new" | "update" | "same" | "shared_mpn" | "sku_taken" | "hidden" | "not_kept";

export type PartPlanLine = {
  status: PartPlanStatus;
  row: PartImportRow;
  partId: number | null;
  /** What changes, as "Base Price $10.00 → $12.00". */
  changes: string[];
  /** Why a line is not applied. */
  reason: string | null;
};

const money = (n: number | null) => (n == null ? "none" : n.toLocaleString("en-US", { style: "currency", currency: "USD" }));

function byMpn<T extends { mpn: string | null }>(parts: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const p of parts) {
    const k = mpnKey(p.mpn);
    if (!k) continue;
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return m;
}

/**
 * What a parts file will do. An MPN already on a part updates that part; a new MPN adds one. A blank cell or a
 * column the file does not have never changes what is stored. Never a second part for the same MPN: an MPN two
 * parts already share, or a new part whose SKU another part already has, is shown and left out.
 */
export function planPartImport(rows: PartImportRow[], stored: StoredPart[]): PartPlanLine[] {
  const mpns = byMpn(stored);
  const skus = new Map(stored.map((p) => [p.sku.trim().toLowerCase(), p]));
  // A part loaded from the item list before MPNs were kept has its part number only as its SKU: same part.
  const bySkuKey = new Map<string, StoredPart[]>();
  for (const p of stored) {
    const k = mpnKey(p.sku);
    if (k && !mpnKey(p.mpn)) bySkuKey.set(k, [...(bySkuKey.get(k) ?? []), p]);
  }
  return rows.map((row): PartPlanLine => {
    const key = mpnKey(row.mpn);
    const hits = [...(mpns.get(key) ?? [])];
    for (const p of bySkuKey.get(key) ?? []) if (!hits.some((h) => h.id === p.id)) hits.push(p);
    if (row.keep === false) {
      // A class outside the five: never added. A part already on the list is moved off the active list (MPN kept).
      const was = hits.length === 1 && !hits[0]!.hidden && hits[0]!.active !== false ? hits[0]! : null;
      return {
        status: "not_kept",
        row,
        partId: was?.id ?? null,
        changes: was ? ["Moved off the active list"] : [],
        reason: `Class ${row.sourceClass ?? ""} is not one of ${PART_CLASSES.join(", ")}.`,
      };
    }
    if (hits.length > 1) {
      return { status: "shared_mpn", row, partId: null, changes: [], reason: `${hits.length} parts already share MPN ${row.mpn} (${hits.map((h) => h.sku).join(", ")}). Fix that on Parts first.` };
    }
    const hit = hits[0];
    if (!hit) {
      const sku = row.sku ?? row.mpn;
      const taken = skus.get(sku.trim().toLowerCase());
      if (taken?.hidden) return { status: "hidden", row, partId: taken.id, changes: [], reason: `SKU ${sku} is hidden. Hidden, skipped.` };
      if (taken) return { status: "sku_taken", row, partId: null, changes: [], reason: `SKU ${sku} is already a part${taken.mpn ? ` with MPN ${taken.mpn}` : " with no MPN"}.` };
      return { status: "new", row, partId: null, changes: [`New part ${itemFullName(sku, row.parent)}`], reason: null };
    }
    if (hit.hidden) return { status: "hidden", row, partId: hit.id, changes: [], reason: "Hidden, skipped. This part stays hidden." };
    const changes: string[] = [];
    if (row.description != null && row.description !== (hit.description ?? "")) changes.push(`Description → ${row.description}`);
    if (row.rate != null && row.rate !== hit.rate) changes.push(`Base Price ${money(hit.rate)} → ${money(row.rate)}`);
    if (row.cost != null && row.cost !== hit.cost) changes.push(`Purchase Price ${money(hit.cost)} → ${money(row.cost)}`);
    if (row.mpn !== (hit.mpn ?? "")) changes.push(`MPN written ${row.mpn}`);
    if (row.cls != null && row.cls !== (hit.itemClass ?? "")) changes.push(`Class → ${row.cls}`);
    if (row.active != null && hit.active != null && row.active !== hit.active) changes.push(row.active ? "Active again" : "Marked inactive");
    return { status: changes.length ? "update" : "same", row, partId: hit.id, changes, reason: null };
  });
}

// ------------------------------------------------------------------------------------------ pricing file

type PriceField = "mpn" | "price" | "newPrice";

const PRICE_HEADERS: Record<string, PriceField> = {
  ...Object.fromEntries(Object.entries(PART_HEADERS).filter(([, v]) => v === "mpn")),
  price: "price",
  "list price": "price",
  msrp: "price",
  "unit price": "price",
  "base price": "price",
  "dealer price": "price",
  "new price": "newPrice",
  "new list price": "newPrice",
  "price new": "newPrice",
  "2027 price": "newPrice",
  "2026 price": "newPrice",
} as Record<string, PriceField>;

export type PriceFileRow = { line: number; sheet: string; mpn: string; price: number };

/** Rows of a price file: MPN and price. A "New Price" column wins over a plain Price column. */
export function priceRowsFromSheets(sheets: { name: string; matrix: unknown[][] }[]): { rows: PriceFileRow[]; skipped: number; duplicates: number } {
  const rows: PriceFileRow[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let duplicates = 0;
  let readable = 0;
  for (const sheet of sheets) {
    const found = findHeader(sheet.matrix, PRICE_HEADERS, ["mpn", "newPrice"]) ?? findHeader(sheet.matrix, PRICE_HEADERS, ["mpn", "price"]);
    if (!found) continue;
    readable += 1;
    const col = found.cols.newPrice ?? found.cols.price!;
    for (let i = found.head + 1; i < sheet.matrix.length; i++) {
      const r = sheet.matrix[i] ?? [];
      if (blankRow(r)) continue;
      const mpn = String(r[found.cols.mpn!] ?? "").trim().replace(/\s+/g, " ");
      const price = cleanRate(r[col]);
      if (!mpnKey(mpn) || price == null) {
        skipped += 1;
        continue;
      }
      if (seen.has(mpnKey(mpn))) {
        duplicates += 1;
        continue;
      }
      seen.add(mpnKey(mpn));
      rows.push({ line: i + 1, sheet: sheet.name, mpn, price });
    }
  }
  if (!readable) throw new Error("Could not find an MPN column and a price column. The first row needs headers like MPN and Price (or New Price).");
  return { rows, skipped, duplicates };
}

/** Which price on the part a price file updates. */
export type PriceTarget = "list" | "sell";
export const PRICE_TARGET_LABEL: Record<PriceTarget, string> = { list: "Manufacturer Price", sell: "Our Sell Price (Base Price)" };

export type PricePlanStatus = "change" | "same" | "no_match" | "shared_mpn" | "hidden";
export type PricePlanLine = { status: PricePlanStatus; mpn: string; partId: number | null; sku: string | null; description: string | null; oldPrice: number | null; newPrice: number; pct: number | null };

/** Price file against the parts: matched on MPN only. No Match and shared MPNs stay in the preview and are never applied. */
export function planPricing(rows: PriceFileRow[], stored: StoredPart[], target: PriceTarget): PricePlanLine[] {
  const mpns = byMpn(stored);
  return rows.map((r): PricePlanLine => {
    const hits = mpns.get(mpnKey(r.mpn)) ?? [];
    const base = { mpn: r.mpn, newPrice: r.price };
    if (!hits.length) return { ...base, status: "no_match", partId: null, sku: null, description: null, oldPrice: null, pct: null };
    if (hits.length > 1) return { ...base, status: "shared_mpn", partId: null, sku: hits.map((h) => h.sku).join(", "), description: null, oldPrice: null, pct: null };
    const p = hits[0]!;
    const old = target === "list" ? p.listPrice : p.rate;
    if (p.hidden) return { ...base, status: "hidden", partId: p.id, sku: p.sku, description: p.description, oldPrice: old, pct: null };
    const pct = old != null && old > 0 ? round2(((r.price - old) / old) * 100) : null;
    return { ...base, status: old === r.price ? "same" : "change", partId: p.id, sku: p.sku, description: p.description, oldPrice: old, pct };
  });
}

/** Lines an Approve writes: only matched prices that change. */
export const pricingToApply = (plan: PricePlanLine[]) => plan.filter((l) => l.status === "change" && l.partId != null);

// ------------------------------------------------------------------------------------------ discount rule

/**
 * Our Discount Rule: what we pay a manufacturer. Percent off the manufacturer price, or a fixed dollar amount
 * off it per unit. When a part has no manufacturer price, its NetSuite Purchase Price is the cost.
 */
export type DiscountRule = { mode: "percent"; value: number; note?: string } | { mode: "fixed"; value: number; note?: string };

export function cleanRule(raw: unknown): { rule: DiscountRule | null } | { error: string } {
  if (raw == null) return { rule: null };
  const r = raw as { mode?: unknown; value?: unknown; note?: unknown };
  const text = String(r.value ?? "").replace(/[$,%\s]/g, "");
  if (!text) return { rule: null };
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return { error: "The rule needs a number." };
  const note = String(r.note ?? "").trim().slice(0, 300) || undefined;
  if (r.mode === "percent") {
    if (value >= 100) return { error: "A percent off must be under 100%." };
    return { rule: { mode: "percent", value: round2(value), note } };
  }
  if (r.mode === "fixed") return { rule: { mode: "fixed", value: round2(value), note } };
  return { error: "Pick Percent Off or Fixed Amount Off." };
}

export function ruleLabel(rule: DiscountRule | null | undefined): string {
  if (!rule) return "Not set";
  return rule.mode === "percent" ? `${Number(rule.value.toFixed(2))}% off manufacturer price` : `${money(rule.value)} off manufacturer price, per unit`;
}

export type CostSource = "rule" | "purchase" | "none";

/** One unit's cost: the rule on the manufacturer price, else the Purchase Price, else unknown. */
export function unitCost(part: { listPrice: number | null; cost: number | null }, rule: DiscountRule | null): { cost: number | null; ourDiscount: number | null; source: CostSource } {
  if (part.listPrice != null && rule) {
    const off = rule.mode === "percent" ? (part.listPrice * rule.value) / 100 : Math.min(rule.value, part.listPrice);
    return { cost: round2(part.listPrice - off), ourDiscount: round2(off), source: "rule" };
  }
  if (part.cost != null) return { cost: round2(part.cost), ourDiscount: part.listPrice != null ? round2(Math.max(0, part.listPrice - part.cost)) : null, source: "purchase" };
  return { cost: null, ourDiscount: null, source: "none" };
}

export type LineProfit = {
  qty: number;
  unitCost: number | null;
  /** qty × unit cost. */
  cost: number | null;
  /** qty × rate on the ticket line. */
  sell: number;
  /** Our discount off the manufacturer price, qty × per unit. */
  ourDiscount: number | null;
  /** This line's share of the ticket discount given to the customer. */
  ticketDiscount: number;
  /** sell − ticket discount − cost. */
  margin: number | null;
  marginPct: number | null;
  source: CostSource;
};

export function lineProfit(line: { qty: number; rate: number }, part: { listPrice: number | null; cost: number | null }, rule: DiscountRule | null, ticketDiscount = 0): LineProfit {
  const u = unitCost(part, rule);
  const sell = round2(line.qty * line.rate);
  const cost = u.cost == null ? null : round2(line.qty * u.cost);
  const net = round2(sell - ticketDiscount);
  const margin = cost == null ? null : round2(net - cost);
  return {
    qty: line.qty,
    unitCost: u.cost,
    cost,
    sell,
    ourDiscount: u.ourDiscount == null ? null : round2(line.qty * u.ourDiscount),
    ticketDiscount: round2(ticketDiscount),
    margin,
    marginPct: margin == null || net <= 0 ? null : round2((margin / net) * 100),
    source: u.source,
  };
}

/** The ticket discount spread over its lines by amount, in cents, so the shares add back to the discount exactly. */
export function discountShares(amounts: number[], off: number): number[] {
  const total = amounts.reduce((s, a) => s + a, 0);
  if (!(off > 0) || !(total > 0)) return amounts.map(() => 0);
  const cents = Math.round(off * 100);
  const raw = amounts.map((a) => (a / total) * cents);
  const floor = raw.map(Math.floor);
  let left = cents - floor.reduce((s, a) => s + a, 0);
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac);
  for (const o of order) {
    if (left <= 0) break;
    floor[o.i] += 1;
    left -= 1;
  }
  return floor.map((c) => c / 100);
}

// ------------------------------------------------------------------------------------------ parts profit

export type ProfitLine = { mpn: string; sku: string; description: string; qty: number; cost: number | null; sell: number; ourDiscount: number | null; ticketDiscount: number; margin: number | null };

export type ProfitRow = {
  mpn: string;
  sku: string;
  description: string;
  qty: number;
  cost: number;
  sell: number;
  ourDiscount: number;
  ticketDiscount: number;
  margin: number;
  marginPct: number | null;
  /** Lines with no cost known: left out of cost and margin, and counted here. */
  noCost: number;
};

/** Invoiced part lines summed per MPN, biggest margin first. */
export function profitByMpn(lines: ProfitLine[]): ProfitRow[] {
  const m = new Map<string, ProfitRow>();
  for (const l of lines) {
    const key = mpnKey(l.mpn) || `SKU:${l.sku.toUpperCase()}`;
    const r = m.get(key) ?? { mpn: l.mpn || "No MPN", sku: l.sku, description: l.description, qty: 0, cost: 0, sell: 0, ourDiscount: 0, ticketDiscount: 0, margin: 0, marginPct: null, noCost: 0 };
    r.qty = round2(r.qty + l.qty);
    r.sell = round2(r.sell + l.sell);
    r.ticketDiscount = round2(r.ticketDiscount + l.ticketDiscount);
    if (l.cost == null || l.margin == null) r.noCost += 1;
    else {
      r.cost = round2(r.cost + l.cost);
      r.margin = round2(r.margin + l.margin);
      r.ourDiscount = round2(r.ourDiscount + (l.ourDiscount ?? 0));
    }
    m.set(key, r);
  }
  return [...m.values()]
    .map((r) => {
      const net = r.sell - r.ticketDiscount;
      // A margin % only when every line on this MPN has a cost; otherwise it would read too high.
      return { ...r, marginPct: !r.noCost && net > 0 ? round2((r.margin / net) * 100) : null };
    })
    .sort((a, b) => b.margin - a.margin || a.mpn.localeCompare(b.mpn));
}

export const PROFIT_COLUMNS = ["MPN", "SKU", "Description", "Qty Invoiced", "Cost", "Sell", "Discount", "Ticket Discount", "Margin", "Margin %"];
export const PROFIT_WEIGHTS = [80, 80, 170, 50, 60, 60, 60, 60, 60, 46];

export function profitCells(r: ProfitRow): string[] {
  const m = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return [
    r.mpn,
    r.sku,
    r.description.length > 160 ? `${r.description.slice(0, 159)}…` : r.description,
    String(r.qty),
    m(r.cost) + (r.noCost ? ` (${r.noCost} line${r.noCost === 1 ? "" : "s"} no cost)` : ""),
    m(r.sell),
    m(r.ourDiscount),
    m(r.ticketDiscount),
    m(r.margin),
    r.marginPct == null ? "—" : `${r.marginPct}%`,
  ];
}

export function profitFileName(date: string, format: "pdf" | "xlsx" | "docx"): string {
  return `KatzDesk-Parts-Profit-${date}.${format}`;
}

export type ProfitTotals = { lines: number; qty: number; cost: number; sell: number; ourDiscount: number; ticketDiscount: number; margin: number; marginPct: number | null; noCost: number };

export function profitTotals(rows: ProfitRow[], lineCount: number): ProfitTotals {
  const sum = (f: (r: ProfitRow) => number) => round2(rows.reduce((s, r) => s + f(r), 0));
  const t = { lines: lineCount, qty: sum((r) => r.qty), cost: sum((r) => r.cost), sell: sum((r) => r.sell), ourDiscount: sum((r) => r.ourDiscount), ticketDiscount: sum((r) => r.ticketDiscount), margin: sum((r) => r.margin), noCost: rows.reduce((s, r) => s + r.noCost, 0) };
  const net = t.sell - t.ticketDiscount;
  return { ...t, marginPct: !t.noCost && net > 0 ? round2((t.margin / net) * 100) : null };
}

/**
 * The Parts Profit report every export is written from (same shape as the Analytics report): a summary table and
 * one row per MPN.
 */
export function buildProfitReport(rows: ProfitRow[], totals: ProfitTotals, opts: { generated: string; scope: string }) {
  const m = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
  return {
    title: "Katz Desk Parts Profit",
    generated: `Generated ${opts.generated}`,
    scope: opts.scope,
    summary: {
      title: "Summary",
      columns: ["Part Lines", "Qty Invoiced", "Cost", "Sell", "Discount", "Ticket Discount", "Margin", "Margin %"],
      weights: [70, 70, 90, 90, 90, 90, 90, 70],
      rows: [[String(totals.lines), String(totals.qty), m(totals.cost), m(totals.sell), m(totals.ourDiscount), m(totals.ticketDiscount), m(totals.margin), totals.marginPct == null ? "—" : `${totals.marginPct}%`]],
    },
    records: { title: "Parts", columns: [...PROFIT_COLUMNS], weights: [...PROFIT_WEIGHTS], rows: rows.map(profitCells) },
  };
}
