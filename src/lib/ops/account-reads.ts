import type { Sql } from "@/lib/db";
import { ofAccount, perAccountJoin } from "@/lib/ops/read-by-id";

/**
 * The Accounts area's reads (phase C5): the Customers list's counts and the account window's lists. `byId` is the
 * Accounts switch on Link Check (readsById(sql, "accounts")). Off, they match the name in any capitals, as before C5.
 */

const OPEN_CALL = "not t.done and t.status not in ('Completed', 'Cancelled', 'Phone Resolved')";

/** The Customers list: every listed account with its calls, TLCs, PMs, installs, deals and recipes, open ones too. */
export function customerRecordsSql(byId: boolean): string {
  const join = (table: string, alias: string, where: string, counts: string) => perAccountJoin({ table, alias, where, counts, byId });
  return `select
         d.id,
         d.name,
         d.avi_katz,
         d.account_rep,
         d.name_locked,
         d.removal_flag,
         d.account_number,
         d.inactive,
         d.retired_at,
         coalesce(svc.n, 0)::int as calls,
         coalesce(svc.p, 0)::int as pending_calls,
         coalesce(tlc.n, 0)::int as tlcs,
         coalesce(tlc.p, 0)::int as pending_tlcs,
         coalesce(pm.n, 0)::int as pms,
         coalesce(pm.p, 0)::int as pending_pms,
         coalesce(inst.n, 0)::int as installs,
         coalesce(inst.p, 0)::int as pending_installs,
         coalesce(deal.n, 0)::int as deals,
         coalesce(rcp.n, 0)::int as recipes
       from directory_customers d
       ${join(
         "service_jobs",
         "svc",
         "coalesce(t.kind, 'service') = 'service' and coalesce(t.customer, '') <> ''",
         `count(*)::int as n, count(*) filter (where ${OPEN_CALL})::int as p`,
       )}
       ${join("service_jobs", "tlc", "t.kind = 'tlc' and coalesce(t.customer, '') <> ''", `count(*)::int as n, count(*) filter (where ${OPEN_CALL})::int as p`)}
       ${join(
         "pm_jobs",
         "pm",
         "coalesce(t.customer, '') <> '' and t.moved_job_id is null",
         "count(*)::int as n, count(*) filter (where not t.done and t.status not in ('Completed', 'Cancelled'))::int as p",
       )}
       ${join(
         "installs",
         "inst",
         "t.archived = false and coalesce(t.customer, '') <> ''",
         "count(*)::int as n, count(*) filter (where not t.complete and coalesce(t.equip_status, '') <> 'Installed')::int as p",
       )}
       ${join("deals", "deal", "t.archived = false and coalesce(t.customer, '') <> ''", "count(*)::int as n")}
       ${join("recipes", "rcp", "coalesce(t.customer, '') <> ''", "count(*)::int as n")}
       where d.archived = false
       order by lower(d.name)`;
}

export type AccountRecordRows = {
  jobs: Record<string, any>[];
  pms: Record<string, any>[];
  installs: Record<string, any>[];
  deals: Record<string, any>[];
  recipes: Record<string, any>[];
};

/** The account window's tickets, PMs, installs, deals and recipes, newest first (getCustomerHistory). */
export async function accountRecordRows(sql: Pick<Sql, "query">, account: { id: number; name: string }, byId: boolean): Promise<AccountRecordRows> {
  const of = ofAccount({ name: "t.customer", id: "t.customer_id", match: "lower", byId, nameParam: "$1", idParam: "$2" });
  // The id is sent only when the where clause has a place for it (Postgres won't type an unused parameter).
  const params = byId ? [account.name, account.id] : [account.name];
  const rows = (text: string) => sql.query<Record<string, any>>(text, params);
  return {
    jobs: await rows(`select t.* from service_jobs t where ${of} order by t.received desc nulls last, t.id desc`),
    pms: await rows(`select t.* from pm_jobs t where ${of} and t.moved_job_id is null order by t.received desc nulls last, t.id desc`),
    installs: await rows(`select t.* from installs t where t.archived = false and ${of} order by t.install_date desc nulls last, t.id desc`),
    deals: await rows(`select t.* from deals t where t.archived = false and ${of} order by t.date_of_deal desc nulls last, t.id desc`),
    recipes: await rows(`select t.* from recipes t where ${of} order by t.equipment_model`),
  };
}
