import type { Sql } from "@/lib/db";

/**
 * The listed account a bill belongs to, for the Profit report's By Account tables (Chuy, 11/26), as SQL: the record's id
 * when it names a listed account, else the listed account its name means (katz_customer_id, as Set ids fills an id),
 * else null. `id` and `name` are the record's columns or expressions, qualified.
 */
export const listedAccountSql = (id: string, name: string) =>
  `coalesce((select own.id from directory_customers own where own.id = ${id} and own.archived = false), katz_customer_id(${name}))`;

/** The listed accounts' names now, by id. */
export async function accountNames(sql: Pick<Sql, "query">, ids: (number | null)[]): Promise<Map<number, string>> {
  const want = [...new Set(ids.filter((n): n is number => n != null))];
  if (!want.length) return new Map();
  const rows = await sql.query<{ id: number; name: string }>("select id, name from directory_customers where archived = false and id = any($1::int[])", [want]);
  return new Map(rows.map((r) => [Number(r.id), r.name.trim()]));
}
