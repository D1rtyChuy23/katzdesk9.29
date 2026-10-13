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

/** The item name a ticket discount is billed under. */
export const DISCOUNT_ITEM = "Discount";

/**
 * Billing rows with each ticket's discount as one more row after that ticket's lines: qty 1 at minus the dollars off.
 * Rows must arrive grouped by ticket. A ticket with no discount, or nothing to take it off, gets no extra row.
 */
export function withDiscountRows<T extends { jobId: number; item: string; description: string; qty: number; rate: number }>(
  rows: T[],
  discounts: Map<number, Discount>,
): T[] {
  const out: T[] = [];
  rows.forEach((r, i) => {
    out.push(r);
    const last = i === rows.length - 1 || rows[i + 1].jobId !== r.jobId;
    const d = discounts.get(r.jobId);
    if (!last || !d) return;
    const subtotal = rows.filter((x) => x.jobId === r.jobId).reduce((sum, x) => sum + round2(x.qty * x.rate), 0);
    const { off } = applyDiscount(subtotal, d);
    if (off > 0) out.push({ ...r, item: DISCOUNT_ITEM, description: discountLabel(d), qty: 1, rate: -off });
  });
  return out;
}
