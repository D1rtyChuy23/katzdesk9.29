/**
 * Discount on a ticket: Percent or Amount, one value. It is always taken off the charge lines' subtotal, never off
 * a total that is already discounted, so it cannot be applied twice.
 * Pure: no server imports, safe for node --test.
 */
import { round2 } from "./charges.ts";

export const DISCOUNT_KINDS = ["percent", "amount"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];
export type Discount = { kind: DiscountKind; value: number };

export const isDiscountKind = (v: unknown): v is DiscountKind => v === "percent" || v === "amount";

/** What was typed, as a discount: null when blank or zero (no discount), or a sentence saying what is wrong. */
export function cleanDiscount(kind: unknown, raw: unknown): { discount: Discount | null } | { error: string } {
  const text = String(raw ?? "").replace(/[$,%\s]/g, "");
  if (!text) return { discount: null };
  if (!/^\d+(\.\d+)?$/.test(text)) return { error: "The discount must be a number." };
  const value = round2(Number(text));
  if (!value) return { discount: null };
  if (!isDiscountKind(kind)) return { error: "Pick Percent or Amount." };
  if (kind === "percent" && value > 100) return { error: "A percent discount can be at most 100%." };
  return { discount: { kind, value } };
}

export type DiscountedTotal = {
  /** The charge lines added up: the original total. */
  subtotal: number;
  /** Dollars taken off. Never more than the subtotal. */
  off: number;
  /** The new total. */
  total: number;
};

/** The original total, the discount in dollars and the new total. */
export function applyDiscount(subtotal: number, discount: Discount | null | undefined): DiscountedTotal {
  const base = round2(Math.max(0, subtotal));
  if (!discount || !(discount.value > 0)) return { subtotal: base, off: 0, total: base };
  const raw = discount.kind === "percent" ? (base * Math.min(discount.value, 100)) / 100 : discount.value;
  const off = round2(Math.min(base, raw));
  return { subtotal: base, off, total: round2(base - off) };
}

/** "10% off" or "$25.00 off". */
export function discountLabel(discount: Discount | null | undefined): string {
  if (!discount) return "";
  return discount.kind === "percent"
    ? `${Number(discount.value.toFixed(2))}% off`
    : `${discount.value.toLocaleString("en-US", { style: "currency", currency: "USD" })} off`;
}

/** NetSuite's header discount item. A ticket's discount is billed as this, never as a discount line. */
export const HEADER_DISCOUNT_ITEM = "CLDSERVICE";

/**
 * Billing rows with each ticket's discount as NetSuite's header discount (Grok's rule through Chuy, 10/28): every row of
 * a discounted ticket carries Discount Item CLDSERVICE and Discount Rate at minus the dollars off (a percent is turned
 * into dollars). There is no discount line. Rows must arrive grouped by ticket.
 */
export function withHeaderDiscount<T extends { jobId: number; qty: number; rate: number }>(
  rows: T[],
  discounts: Map<number, Discount>,
): (T & { discountItem: string; discountRate: string; discountLabel: string })[] {
  const subtotals = new Map<number, number>();
  for (const r of rows) subtotals.set(r.jobId, (subtotals.get(r.jobId) ?? 0) + round2(r.qty * r.rate));
  return rows.map((r) => {
    const d = discounts.get(r.jobId);
    const { off } = applyDiscount(subtotals.get(r.jobId) ?? 0, d);
    return off > 0 && d
      ? { ...r, discountItem: HEADER_DISCOUNT_ITEM, discountRate: (-off).toFixed(2), discountLabel: discountLabel(d) }
      : { ...r, discountItem: "", discountRate: "", discountLabel: "" };
  });
}
