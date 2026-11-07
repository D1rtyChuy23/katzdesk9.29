/**
 * A bill's discount: Percent or Amount, one value, on the Whole bill or on Chosen lines (Chuy, 11/7). It is always
 * taken off the lines, never off a total that is already discounted, so it cannot be applied twice. On Chosen lines it
 * comes off only the lines ticked for it (the base); the other lines bill in full.
 * Pure: no server imports, safe for node --test.
 */
import { chargesTotal, lineAmount, round2 } from "./charges.ts";

export const DISCOUNT_KINDS = ["percent", "amount"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];
/** Whole bill ("all"), or Chosen lines ("chosen"): only the lines ticked for it. As stored in discount_scope. */
export type DiscountScope = "all" | "chosen";
/** No scope means Whole bill: every discount saved before 11/7 is one. */
export type Discount = { kind: DiscountKind; value: number; scope?: "chosen" };

export const isDiscountKind = (v: unknown): v is DiscountKind => v === "percent" || v === "amount";

export const CHOSEN_NONE = "Tick the lines the discount comes off, or make it Whole bill.";
/** A page opened before Chosen lines existed sends no scope or ticks: it can't save over a bill that has them. */
export const OUT_OF_DATE = "This page is out of date. Reload it, then save again.";
export const SCOPE_ERROR = "Pick Whole bill or Chosen lines.";

const withScope = (d: { kind: DiscountKind; value: number }, scope: unknown): Discount => (scope === "chosen" ? { ...d, scope: "chosen" } : d);

/**
 * What was typed, as a discount: null when blank or zero (no discount), or a sentence saying what is wrong. A scope of
 * "chosen" keeps it on Chosen lines; "all", or none, is Whole bill.
 */
export function cleanDiscount(kind: unknown, raw: unknown, scope?: unknown): { discount: Discount | null } | { error: string } {
  if (scope != null && scope !== "all" && scope !== "chosen") return { error: SCOPE_ERROR };
  const text = String(raw ?? "").replace(/[$,%\s]/g, "");
  if (!text) return { discount: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { error: "The discount must be a number." };
  const value = round2(Number(text));
  if (!value) return { discount: null };
  if (!isDiscountKind(kind)) return { error: "Pick Percent or Amount." };
  if (kind === "percent" && value > 100) return { error: "A percent discount can be at most 100%." };
  return { discount: withScope({ kind, value }, scope) };
}

/** A discount as a bill's row stores it (discount_kind, discount_value, discount_scope): null unless it takes something off. */
export function discountFromRow(kind: unknown, value: unknown, scope?: unknown): Discount | null {
  const v = Number(value);
  return isDiscountKind(kind) && v > 0 ? withScope({ kind, value: v }, scope) : null;
}

/** A line as the discount reads it. discountChosen is its tick, read only on a Chosen-lines discount. */
export type DiscountLine = { qty: number; rate: number; discountChosen?: boolean | null };

/** Whether the discount comes off this line: every line on the Whole bill, only a ticked one on Chosen lines. */
export function takesDiscount(line: Pick<DiscountLine, "discountChosen">, discount: Discount | null | undefined): boolean {
  if (!discount) return false;
  return discount.scope !== "chosen" || line.discountChosen === true;
}

/** What the lines the discount comes off add up to, each line to the cent as in chargesTotal. */
export function discountBase(lines: DiscountLine[], discount: Discount | null | undefined): number {
  return round2(lines.reduce((sum, l) => (takesDiscount(l, discount) ? sum + lineAmount(l) : sum), 0));
}

export type DiscountedTotal = {
  /** The charge lines added up: the original total. */
  subtotal: number;
  /** Dollars taken off. Never more than the lines the discount comes off. */
  off: number;
  /** The new total. */
  total: number;
};

/**
 * The original total, the discount in dollars and the new total. The discount comes off the base: what the lines it
 * comes off add up to (the subtotal on the Whole bill), held between 0 and the subtotal.
 */
export function applyDiscount(subtotal: number, discount: Discount | null | undefined, base: number = subtotal): DiscountedTotal {
  const sub = round2(Math.max(0, subtotal));
  if (!discount || !(discount.value > 0)) return { subtotal: sub, off: 0, total: sub };
  const from = Math.min(round2(Math.max(0, base)), sub);
  const raw = discount.kind === "percent" ? (from * Math.min(discount.value, 100)) / 100 : discount.value;
  const off = round2(Math.min(from, raw));
  return { subtotal: sub, off, total: round2(sub - off) };
}

/** A bill's lines added up, the dollars off the lines the discount comes off, and the new total. */
export function billTotals(lines: DiscountLine[], discount: Discount | null | undefined): DiscountedTotal {
  return applyDiscount(chargesTotal(lines), discount, discountBase(lines, discount));
}

/** "10% off" or "$25.00 off". */
export function discountLabel(discount: Discount | null | undefined): string {
  if (!discount) return "";
  return discount.kind === "percent"
    ? `${Number(discount.value.toFixed(2))}% off`
    : `${discount.value.toLocaleString("en-US", { style: "currency", currency: "USD" })} off`;
}

/** What the discount came off: "10% off" on the Whole bill, "10% off 3 of 5 lines" on Chosen lines. */
export function discountOffLabel(discount: Discount | null | undefined, lines: Pick<DiscountLine, "discountChosen">[]): string {
  if (!discount) return "";
  if (discount.scope !== "chosen") return discountLabel(discount);
  const n = lines.filter((l) => takesDiscount(l, discount)).length;
  return `${discountLabel(discount)} ${n} of ${lines.length} line${lines.length === 1 ? "" : "s"}`;
}

/** A Chosen-lines discount on a bill with lines, none of them ticked: it can't be saved. A bill with no lines can. */
export function chosenDiscountError(lines: Pick<DiscountLine, "discountChosen">[], discount: Discount | null | undefined): string | null {
  if (discount?.scope !== "chosen" || !lines.length) return null;
  return lines.some((l) => l.discountChosen === true) ? null : CHOSEN_NONE;
}

/**
 * The base in SQL, as an aggregate over a bill's lines: `line` is the lines' alias, `scope` the bill's discount_scope.
 * Each line is rounded to the cent first, as in chargesTotal.
 */
export const DISCOUNT_BASE_SQL = (line: string, scope: string): string =>
  `coalesce(sum(round(${line}.qty * ${line}.rate, 2)) filter (where ${scope} = 'all' or ${line}.discount_chosen), 0)`;

/** NetSuite's header discount item. A ticket's discount is billed as this, never as a discount line. */
export const HEADER_DISCOUNT_ITEM = "CLDSERVICE";

/**
 * Billing rows with each ticket's discount as NetSuite's header discount (Grok's rule through Chuy, 10/28): every row of
 * a discounted ticket carries Discount Item CLDSERVICE and Discount Rate at minus the dollars off (a percent is turned
 * into dollars). There is no discount line. On Chosen lines the dollars are those off its ticked rows (11/7), so
 * NetSuite's total still matches. Rows must arrive grouped by ticket.
 */
export function withHeaderDiscount<T extends { jobId: number; qty: number; rate: number; discountChosen?: boolean | null }>(
  rows: T[],
  discounts: Map<number, Discount>,
): (T & { discountItem: string; discountRate: string; discountLabel: string })[] {
  const subtotals = new Map<number, number>();
  const bases = new Map<number, number>();
  for (const r of rows) {
    const amount = round2(r.qty * r.rate);
    subtotals.set(r.jobId, (subtotals.get(r.jobId) ?? 0) + amount);
    if (takesDiscount(r, discounts.get(r.jobId))) bases.set(r.jobId, (bases.get(r.jobId) ?? 0) + amount);
  }
  return rows.map((r) => {
    const d = discounts.get(r.jobId);
    const { off } = applyDiscount(subtotals.get(r.jobId) ?? 0, d, bases.get(r.jobId) ?? 0);
    return off > 0 && d
      ? { ...r, discountItem: HEADER_DISCOUNT_ITEM, discountRate: (-off).toFixed(2), discountLabel: discountLabel(d) }
      : { ...r, discountItem: "", discountRate: "", discountLabel: "" };
  });
}
