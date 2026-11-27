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

/**
 * The listed account a copy of a customer name carries (C6): `id` (the source record's) when it names a listed account,
 * else the listed account `name` finds, else null.
 */
export async function listedAccountOf(sql: Pick<Sql, "query">, id: number | string | null | undefined, name: string | null | undefined): Promise<number | null> {
  const row = (await sql.query<{ id: number | null }>(`select ${listedAccountSql("$1::int", "$2::text")} as id`, [id == null ? null : Number(id), name ?? null]))[0];
  return row?.id == null ? null : Number(row.id);
}

/**
 * An invoice's account with its name (C6), as SQL: the billed record's listed account (listedAccountSql) when the record
 * is saved under that name, else the listed account the name finds. `type` is the invoice's entity type (pm, install,
 * deal, rebuild, service, tlc), `id` the record's id and `name` the customer the invoice is saved with.
 */
export const invoiceAccountSql = (type: string, id: string, name: string) => {
  const of = (table: string, alias: string, nameCol: string, idCol: string) =>
    `(select ${listedAccountSql(`${alias}.${idCol}`, `${alias}.${nameCol}`)} from ${table} ${alias} where ${alias}.id = ${id} and btrim(${alias}.${nameCol}) = btrim(${name}))`;
  return `coalesce(case ${type}
             when 'pm' then ${of("pm_jobs", "rp", "customer", "customer_id")}
             when 'install' then ${of("installs", "ri", "customer", "customer_id")}
             when 'deal' then ${of("deals", "rd", "customer", "customer_id")}
             when 'rebuild' then ${of("rebuilds", "rr", "account", "account_id")}
             when 'service' then ${of("service_jobs", "rj", "customer", "customer_id")}
             when 'tlc' then ${of("service_jobs", "rj", "customer", "customer_id")}
           end, katz_customer_id(${name}))`;
};
