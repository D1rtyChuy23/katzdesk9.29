/**
 * Ticket and TLC call numbers: SC-YYYYMM-NNN, counted per month the ticket was received (11/9). The count is read
 * as a number. Read as text, "999" sorted above "1000", so the 1,000th ticket of a month got a number already used.
 */
import type { Sql } from "@/lib/db";

/** The count at the end of a call number; 0 when it has none. */
export function callIdNumber(callId: string): number {
  const n = Number(/(\d+)$/.exec(callId.trim())?.[1] ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** At least three digits, more once a month passes 999. */
export function formatCallId(prefix: string, n: number): string {
  return `${prefix}${String(n).padStart(3, "0")}`;
}

/** The next free call number for the month `received` (YYYY-MM-DD) falls in. */
export async function nextCallId(sql: Sql, received: string): Promise<string> {
  const prefix = `SC-${received.replace(/-/g, "").slice(0, 6)}-`;
  const rows = await sql.query<{ call_id: string }>("select call_id from service_jobs where call_id like $1", [prefix + "%"]);
  const last = rows.reduce((max, r) => Math.max(max, callIdNumber(r.call_id.slice(prefix.length))), 0);
  return formatCallId(prefix, last + 1);
}
