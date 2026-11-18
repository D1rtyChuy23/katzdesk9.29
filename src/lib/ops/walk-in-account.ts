/**
 * The one shared Walk - In account. It already exists (name exactly "Walk - In").
 * The walk_in column marks renamed child accounts, not this parent, so it is not how the account is found.
 * Nothing here creates a second one. A missing account is a stop, not a reason to insert a row.
 */
import { isWalkIn } from "./customer-key.ts";

export const WALK_IN_ACCOUNT_NAME = "Walk - In";

/** On a PM, install or TLC already sitting on Walk - In, so it can be found and moved. */
export const WALK_IN_MOVE = "On Walk - In: move it to the café's account";

type QuerySql = { query: (text: string, params?: unknown[]) => Promise<{ name?: string }[]> };

/** The live account named exactly "Walk - In". Null when it isn't there, or the only row is archived. */
export async function walkInAccountName(sql: QuerySql): Promise<string | null> {
  const rows = await sql.query(
    `select name from directory_customers
      where archived = false and name = $1
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

/**
 * Refuse only a move onto Walk - In. A save that sends the customer the record already has
 * (the windows send it on every save) is allowed, and so is a move off Walk - In.
 * Creating a record still uses assertWalkInSite.
 */
export function assertWalkInMove(kind: WalkInSite, current: string | null | undefined, next: string | null | undefined): void {
  if (next === undefined) return;
  if (isWalkIn(next) && !isWalkIn(current)) assertWalkInSite(kind, next);
}

/** SQL fragment: this text column is not the Walk - In account. */
export function notWalkInSql(column: string): string {
  return `regexp_replace(lower(btrim(coalesce(${column}, ''))), '[^a-z0-9]+', '', 'g') <> 'walkin'`;
}
