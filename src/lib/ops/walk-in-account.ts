/**
 * The one shared Walk - In account. It already exists (name exactly "Walk - In", walk_in = true).
 * Nothing here creates a second one. A missing account is a stop, not a reason to insert a row.
 */
import { isWalkIn } from "./customer-key.ts";

export const WALK_IN_ACCOUNT_NAME = "Walk - In";

type QuerySql = { query: (text: string, params?: unknown[]) => Promise<{ name?: string }[]> };

/** The live account named exactly "Walk - In" and marked walk_in. Null when it isn't there. */
export async function walkInAccountName(sql: QuerySql): Promise<string | null> {
  const rows = await sql.query(
    `select name from directory_customers
      where archived = false and walk_in is true and name = $1
      order by id
      limit 1`,
    [WALK_IN_ACCOUNT_NAME],
  );
  const name = rows[0]?.name;
  return name === WALK_IN_ACCOUNT_NAME ? WALK_IN_ACCOUNT_NAME : null;
}

export type WalkInSite = "pm" | "install" | "deal" | "tlc" | "equipment";

/**
 * Why this record cannot be placed on Walk - In, or null when the name is a real account
 * (or a one-time service ticket, which is allowed on that account).
 */
export function walkInSiteRefusal(kind: WalkInSite, name: string | null | undefined): string | null {
  if (!isWalkIn(name)) return null;
  if (kind === "equipment") return "A walk-in has no account to add equipment to.";
  const what = kind === "pm" ? "a PM" : kind === "install" ? "an install" : kind === "deal" ? "a deal" : "a TLC schedule";
  return `Walk - In doesn't take ${what}. Pick the café's account.`;
}

export function assertWalkInSite(kind: WalkInSite, name: string | null | undefined): void {
  const why = walkInSiteRefusal(kind, name);
  if (why) throw new Error(why);
}

/** SQL fragment: this text column is not the Walk - In account. */
export function notWalkInSql(column: string): string {
  return `regexp_replace(lower(btrim(coalesce(${column}, ''))), '[^a-z0-9]+', '', 'g') <> 'walkin'`;
}
