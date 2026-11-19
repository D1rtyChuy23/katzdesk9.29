/**
 * A unit moved to another account keeps its details (Chuy, 11/19): ITCB154148 arrived on Lopez Mexican Restaurant
 * with its Part #, Ownership, Install date and Condition blank. A serial move takes the unit off the old account the
 * way Remove does (kept on that account's Retired list) and the install's list makes the unit on the new account; this
 * copies the old unit's details onto that new one. A detail already on the new unit is kept; none is blanked.
 */
import type { Sql } from "@/lib/db";

/** $1 the old unit's id (now on the Retired list), $2 the new unit. Locked units are left as they are. */
export function carryUnitDetailsSql(): string {
  return `update account_equipment a
             set catalog_model = case when coalesce(btrim(a.catalog_model), '') = '' then r.catalog_model else a.catalog_model end,
                 part_number   = coalesce(nullif(btrim(a.part_number), ''), r.part_number),
                 ownership     = coalesce(nullif(btrim(a.ownership), ''), r.ownership),
                 install_date  = coalesce(a.install_date, r.install_date),
                 condition     = coalesce(nullif(btrim(a.condition), ''), r.condition),
                 electrical    = coalesce(nullif(btrim(a.electrical), ''), r.electrical),
                 updated_at    = now()
            from (select * from account_equipment_retired where unit_id = $1 order by id desc limit 1) r
           where a.id = $2 and a.locked_at is null
          returning a.id`;
}

/** Copy the moved unit's details onto the unit the move made. Returns whether anything was written. */
export async function carryUnitDetails(sql: Sql, fromUnitId: number, toUnitId: number): Promise<boolean> {
  return (await sql.query(carryUnitDetailsSql(), [fromUnitId, toUnitId])).length > 0;
}

/** The unit on `customer` with this serial key, newest first: the one a move just made. */
export async function unitBySerial(sql: Sql, customer: string, key: string): Promise<number | null> {
  const row = (
    await sql.query<{ id: number }>("select id from account_equipment where serial_key = $1 and lower(customer) = lower($2) order by id desc limit 1", [
      key,
      customer,
    ])
  )[0];
  return row ? Number(row.id) : null;
}
