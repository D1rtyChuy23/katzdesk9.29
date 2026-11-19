/**
 * Inactive and Retired accounts (Jesus, 11/19). An account is inactive when NetSuite marks it Inactive, or when the Work
 * Order History import restored a removed account to hold its history ("Retired": archived = false, inactive = true,
 * retired_at set). Either way it is hidden from the default customer lists and pickers, never deleted, and it takes no
 * new tickets, installs or PMs. Its history, and the work already on it, stay.
 */
import type { Sql } from "@/lib/db";

type Query = Pick<Sql, "query">;

export type NewWork = "ticket" | "install" | "pm" | "deal";
const WORK_LABEL: Record<NewWork, string> = { ticket: "ticket", install: "install", pm: "PM", deal: "deal" };

export const retiredMessage = (name: string, retired: boolean, what: NewWork, moving = false) =>
  `“${name}” is ${retired ? "Retired" : "Inactive in NetSuite"}, so it can't take ${moving ? `a ${WORK_LABEL[what]} moved onto it` : `a new ${WORK_LABEL[what]}`}. Its history stays. An Admin can make it active again on its Customers sheet.`;

/** "Retired" when the history import restored it, else "Inactive" (NetSuite). Null for an active account. */
export const inactiveLabel = (a: { inactive?: boolean | null; retiredAt?: unknown }) => (a.inactive ? (a.retiredAt ? "Retired" : "Inactive") : null);

/**
 * Refuse new work on an inactive or Retired account, on the server. The name is matched as the account list has it
 * (any capitals, extra spaces). An active account with the same name takes the work, as the pickers offer it. Moving a
 * ticket, PM, install or deal onto one is refused the same way. Work already on it stays and can be finished.
 */
export async function assertTakesNewWork(sql: Query, customer: string | null | undefined, what: NewWork, opts: { moving?: boolean } = {}): Promise<void> {
  const name = String(customer ?? "").trim();
  if (!name) return;
  const rows = await sql.query<{ name: string; inactive: boolean; retired_at: unknown }>(
    "select name, inactive, retired_at from directory_customers where archived = false and lower(btrim(name)) = lower(btrim($1))",
    [name],
  );
  if (!rows.length || rows.some((r) => r.inactive !== true)) return;
  const r = rows[0]!;
  throw new Error(retiredMessage(r.name, r.retired_at != null, what, opts.moving));
}
