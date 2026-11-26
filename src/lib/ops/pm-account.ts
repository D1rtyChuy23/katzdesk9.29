import type { Sql } from "@/lib/db";
import { normalizeCustomerKey } from "@/lib/ops/customer-key";
import { ofAccount, readsById } from "@/lib/ops/read-by-id";

/**
 * The account a PM's runbook reads by (phase C5 part 3, the PMs switch on Link Check → Reading by id).
 *
 * The PM's own account id, when PMs reads by id, the PM has one, and the runbook is planned for the name the PM is saved
 * under (every runbook read passes the PM's own name; a save that changes the PM's customer plans by the new name, and
 * so by name). Otherwise null: the runbook goes by the name, as before C5.
 */
export async function pmAccountId(sql: Pick<Sql, "query">, pmId: number, customer: string | null | undefined): Promise<number | null> {
  if (!(await readsById(sql, "pms"))) return null;
  const pm = (await sql.query<{ customer: string | null; customer_id: number | null }>("select customer, customer_id from pm_jobs where id = $1", [pmId]))[0];
  if (!pm || pm.customer_id == null) return null;
  return normalizeCustomerKey(pm.customer) === normalizeCustomerKey(customer) ? Number(pm.customer_id) : null;
}

/**
 * An account's units for a PM's runbook, oldest first. With the PM's account id, by the id (a unit whose id names no
 * listed account by its name); otherwise by the name in any capitals, as before.
 */
export async function pmAccountUnits<T>(sql: Pick<Sql, "query">, columns: string, customer: string, accountId: number | null): Promise<T[]> {
  // `columns` comes from this module's callers, never from a request.
  if (accountId == null) {
    return sql.query<T>(`select ${columns} from account_equipment a where lower(a.customer) = lower($1) order by a.id`, [customer]);
  }
  const of = ofAccount({ name: "a.customer", id: "a.customer_id", match: "lower", byId: true, nameParam: "$1", idParam: "$2" });
  return sql.query<T>(`select ${columns} from account_equipment a where ${of} order by a.id`, [customer, accountId]);
}

/**
 * The account's other completed PMs (a PM's earlier visits, for its intervals). With the PM's account id, by the id;
 * otherwise by the name in any capitals, as before.
 */
export async function pmEarlierVisits(
  sql: Pick<Sql, "query">,
  customer: string,
  pmId: number,
  accountId: number | null,
): Promise<{ id: number; equipment: string | null; style: string | null; completed_at: string | null }[]> {
  const of =
    accountId == null
      ? "lower(p.customer) = lower($1)"
      : ofAccount({ name: "p.customer", id: "p.customer_id", match: "lower", byId: true, nameParam: "$1", idParam: "$3" });
  return sql.query(
    `select p.id, p.equipment, p.style, p.completed_at::text as completed_at from pm_jobs p
      where ${of} and p.id <> $2 and (p.completed_at is not null or p.status = 'Completed')`,
    accountId == null ? [customer, pmId] : [customer, pmId, accountId],
  );
}

/**
 * Whether a unit is on the PM's account, for the runbook's own saves (log a unit, claim a serial): the same account id
 * when the runbook reads by it, else the same name once punctuation and capitals are dropped, as before.
 */
export function sameAccountAsPm(unit: { customer: string | null; customer_id?: number | null }, pmCustomer: string, accountId: number | null): boolean {
  if (accountId != null && unit.customer_id != null) return Number(unit.customer_id) === accountId;
  return normalizeCustomerKey(unit.customer) === normalizeCustomerKey(pmCustomer);
}
