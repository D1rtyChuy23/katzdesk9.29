/**
 * Our Discount Rule as stored, read on the server. Its own module so the Parts list and the ticket charges can read it
 * without importing the import screens' module (which imports parts-api back).
 */
import type { Sql } from "@/lib/db";
import { cleanRule, type DiscountRule } from "@/lib/ops/part-pricing";

export const RULE_KEY = "our_discount_rule";

export async function loadDiscountRule(sql: Sql): Promise<DiscountRule | null> {
  const row = (await sql.query<{ value: string | null }>("select value from desk_settings where key = $1", [RULE_KEY]))[0];
  if (!row?.value) return null;
  try {
    const r = cleanRule(JSON.parse(row.value));
    return "rule" in r ? r.rule : null;
  } catch {
    return null;
  }
}
