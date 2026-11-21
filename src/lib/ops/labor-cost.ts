/**
 * Labor cost (Chuy, 11/20): billed labor hours × one blended labor cost rate that an Admin sets. It is never a tech's
 * own pay, and the rate is shown only to an Admin.
 */
import type { Sql } from "@/lib/db";
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

export const LABOR_KEY = "labor_cost_rate";

/** The blended labor cost rate ($ per hour), or null when none is set. */
export async function loadLaborRate(sql: Sql): Promise<number | null> {
  const row = (await sql.query<{ value: string | null }>("select value from desk_settings where key = $1", [LABOR_KEY]))[0];
  const r = cleanLaborRate(row?.value ?? null);
  return "rate" in r ? r.rate : null;
}

/** Store the rate, or clear it with null. */
export async function saveLaborRate(sql: Sql, rate: number | null): Promise<void> {
  if (rate == null) await sql.query("delete from desk_settings where key = $1", [LABOR_KEY]);
  else {
    await sql.query(
      `insert into desk_settings (key, value, updated_at) values ($1, $2, now())
       on conflict (key) do update set value = excluded.value, updated_at = now()`,
      [LABOR_KEY, String(rate)],
    );
  }
}

