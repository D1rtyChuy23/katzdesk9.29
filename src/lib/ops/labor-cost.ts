/**
 * Labor cost (Chuy, 11/20): billed labor hours × one blended labor cost rate that an Admin sets. It is never a tech's
 * own pay, and the rate is shown only to an Admin.
 */
import { round2 } from "./charges.ts";

export const LABOR_RATE_MAX = 1000;

/** A typed labor cost rate: dollars per hour, above 0, to the cent. Blank clears it. */
export function cleanLaborRate(value: unknown): { rate: number | null } | { error: string } {
  if (value == null) return { rate: null };
  const text = String(value).replace(/[$,\s]/g, "");
  if (!text) return { rate: null };
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return { error: "Enter the labor cost rate in dollars per hour, above $0." };
  if (n > LABOR_RATE_MAX) return { error: `The labor cost rate can't be over $${LABOR_RATE_MAX} an hour.` };
  return { rate: round2(n) };
}

/** Billed hours × the rate; null when no rate is set. */
export function laborCost(hours: number, rate: number | null): number | null {
  return rate == null ? null : round2(hours * rate);
}
