/**
 * Retired machines and duplicate serials (Chuy, 11/9, before the asset load).
 *
 * Remove on an account's Equipment tab used to delete the unit and its inspection history. It still takes the unit
 * off the account (account_equipment), so every reader of an account's machines is unchanged, but first the unit's
 * record and what was linked to it are copied to account_equipment_retired. Put back returns the unit, under its
 * own id, with the links whose install or PM still exists.
 */
import type { Sql } from "@/lib/db";

export type RetiredUnit = {
  id: number;
  unitId: number;
  customer: string;
  equipmentName: string;
  catalogModel: string;
  serial: string | null;
  partNumber: string | null;
  ownership: string | null;
  installDate: string | null;
  /** The day it was removed, in Houston's time (YYYY-MM-DD). */
  retiredAt: string;
  retiredName: string | null;
  /** How many inspection and PM records were kept with it. */
  records: number;
};

export type RetiredBy = { userId: string | null; name: string | null };

const LINK_KEYS = ["inspection_units", "inspection_items", "inspection_photos", "pm_links"] as const;

/**
 * Copy a unit and its links to the retired table. $1 unit, $2 who (id), $3 who (name). Run before the unit's links
 * are taken off, so they are all in the copy. Returns the retired row's id, or nothing when the unit isn't there.
 */
export function retireUnitSql(): string {
  return `insert into account_equipment_retired
            (unit_id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, part_number, condition,
             unit, links, retired_by, retired_name)
          select a.id, a.customer, a.catalog_model, a.equipment_name, a.serial, a.serial_key, a.install_date, a.electrical, a.ownership, a.part_number, a.condition,
                 to_jsonb(a),
                 jsonb_build_object(
                   'inspection_units', coalesce((select jsonb_agg(to_jsonb(u)) from install_inspection_units u where u.equipment_id = a.id), '[]'::jsonb),
                   'inspection_items', coalesce((select jsonb_agg(to_jsonb(i)) from install_inspection_items i where i.equipment_id = a.id), '[]'::jsonb),
                   'inspection_photos', coalesce((select jsonb_agg(to_jsonb(p)) from install_inspection_photos p where p.equipment_id = a.id), '[]'::jsonb),
                   'pm_links', coalesce((select jsonb_agg(to_jsonb(l)) from pm_runbook_unit_links l where l.account_equipment_id = a.id), '[]'::jsonb),
                   'machine_parts', coalesce((select jsonb_agg(m.id) from machine_parts m where m.account_equipment_id = a.id), '[]'::jsonb)),
                 $2, $3
            from account_equipment a
           where a.id = $1
          returning id`;
}

/** Keep the unit's record before it leaves the account. */
export async function retireUnitRecord(sql: Sql, unitId: number, by?: RetiredBy | null): Promise<number | null> {
  const rows = await sql.query<{ id: number }>(retireUnitSql(), [unitId, by?.userId ?? null, by?.name ?? null]);
  return rows[0] ? Number(rows[0].id) : null;
}

/** The removal didn't go through: the unit is still on the account, so it isn't retired. */
export async function dropRetiredRecord(sql: Sql, retiredId: number): Promise<void> {
  await sql.query("delete from account_equipment_retired where id = $1", [retiredId]);
}

/** An account's retired machines, newest first. A unit that is on the account (again) isn't listed. */
export async function listRetiredUnits(sql: Sql, customer: string): Promise<RetiredUnit[]> {
  const rows = await sql.query<{
    id: number;
    unit_id: number;
    customer: string;
    equipment_name: string;
    catalog_model: string;
    serial: string | null;
    part_number: string | null;
    ownership: string | null;
    install_date: string | null;
    retired_at: string;
    retired_name: string | null;
    records: number;
  }>(
    `select r.id, r.unit_id, r.customer, r.equipment_name, r.catalog_model, r.serial, r.part_number, r.ownership, r.install_date,
            to_char(r.retired_at at time zone 'America/Chicago', 'YYYY-MM-DD') as retired_at, r.retired_name,
            (${LINK_KEYS.map((k) => `jsonb_array_length(coalesce(r.links->'${k}', '[]'::jsonb))`).join(" + ")})::int as records
       from account_equipment_retired r
      where lower(r.customer) = lower($1)
        and not exists (select 1 from account_equipment a where a.id = r.unit_id)
      order by r.retired_at desc, r.id desc`,
    [customer.trim()],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    unitId: Number(r.unit_id),
    customer: r.customer,
    equipmentName: r.equipment_name,
    catalogModel: r.catalog_model,
    serial: r.serial,
    partNumber: r.part_number,
    ownership: r.ownership,
    installDate: r.install_date,
    retiredAt: r.retired_at,
    retiredName: r.retired_name,
    records: Number(r.records),
  }));
}

/**
 * Put a retired machine back, as one statement: the unit under its own id, then the inspection and PM links whose
 * install or PM still exists, and the PM parts lines logged for it, then the retired row is dropped. $1 the retired row, $2 the account's name now.
 */
export function restoreUnitSql(): string {
  return `with r as (select * from account_equipment_retired where id = $1),
          unit as (
            insert into account_equipment
                   (id, customer, catalog_model, equipment_name, serial, serial_key, install_date, electrical, ownership, part_number, condition,
                    created_by_install, created_at, updated_at)
            select r.unit_id, $2, r.catalog_model, r.equipment_name, r.serial, r.serial_key, r.install_date, r.electrical, r.ownership, r.part_number, r.condition,
                   (select i.id from installs i where i.id = (r.unit->>'created_by_install')::int),
                   coalesce((r.unit->>'created_at')::timestamptz, now()), now()
              from r
             where not exists (select 1 from account_equipment a where a.id = r.unit_id)
            returning id
          ),
          units as (
            insert into install_inspection_units
            select x.* from r, jsonb_populate_recordset(null::install_inspection_units, r.links->'inspection_units') x
             where exists (select 1 from unit) and exists (select 1 from installs i where i.id = x.install_id)
            on conflict do nothing
          ),
          items as (
            insert into install_inspection_items
            select x.* from r, jsonb_populate_recordset(null::install_inspection_items, r.links->'inspection_items') x
             where exists (select 1 from unit) and exists (select 1 from installs i where i.id = x.install_id)
            on conflict do nothing
          ),
          photos as (
            insert into install_inspection_photos
            select x.* from r, jsonb_populate_recordset(null::install_inspection_photos, r.links->'inspection_photos') x
             where exists (select 1 from unit) and exists (select 1 from installs i where i.id = x.install_id)
            on conflict do nothing
          ),
          pms as (
            insert into pm_runbook_unit_links
            select x.* from r, jsonb_populate_recordset(null::pm_runbook_unit_links, r.links->'pm_links') x
             where exists (select 1 from unit) and exists (select 1 from pm_jobs p where p.id = x.pm_job_id)
            on conflict do nothing
          ),
          -- Parts logged on a PM for this machine (11/12): the delete set their link to null, so they point at it again.
          -- A line linked to another unit meanwhile keeps that one.
          parts as (
            update machine_parts m set account_equipment_id = (select id from unit)
              from r
             where exists (select 1 from unit) and m.account_equipment_id is null
               and m.id in (select v::int from jsonb_array_elements_text(coalesce(r.links->'machine_parts', '[]'::jsonb)) v)
          ),
          gone as (delete from account_equipment_retired where id = $1 and exists (select 1 from unit))
          select id from unit`;
}

/**
 * Put a retired machine back on its account. Refused when the account is no longer on the customer list, or the
 * serial is on another unit now.
 */
export async function restoreRetiredUnit(sql: Sql, retiredId: number): Promise<{ id: number }> {
  const r = (
    await sql.query<{ unit_id: number; customer: string; serial: string | null; serial_key: string | null }>(
      "select unit_id, customer, serial, serial_key from account_equipment_retired where id = $1",
      [retiredId],
    )
  )[0];
  if (!r) throw new Error("That machine isn't on the retired list.");
  const account = (
    await sql.query<{ name: string }>("select name from directory_customers where archived = false and lower(name) = lower($1) order by name_locked desc, id limit 1", [r.customer])
  )[0];
  if (!account) throw new Error(`${r.customer} is no longer on the customer list.`);
  if (r.serial_key) {
    const on = (await sql.query<{ customer: string }>("select customer from account_equipment where serial_key = $1 and id <> $2 order by id limit 1", [r.serial_key, r.unit_id]))[0];
    if (on) throw new Error(`SN ${r.serial ?? r.serial_key} is on ${on.customer} now. Remove it there first, or leave this one retired.`);
  }
  const rows = await sql.query<{ id: number }>(restoreUnitSql(), [retiredId, account.name]);
  if (!rows[0]) throw new Error("That machine is already on the account.");
  return { id: Number(rows[0].id) };
}

export type DuplicateSerial = {
  serialKey: string;
  units: { id: number; customer: string; customerId: number | null; equipmentName: string; serial: string | null; installDate: string | null; locked: boolean }[];
};

/** Serials that are on more than one account unit, with every unit that has each. Read only. */
export async function listDuplicateSerials(sql: Sql): Promise<DuplicateSerial[]> {
  const rows = await sql.query<{
    id: number;
    serial_key: string;
    customer: string;
    customer_id: number | null;
    equipment_name: string;
    serial: string | null;
    install_date: string | null;
    locked: boolean;
  }>(
    `select e.id, e.serial_key, e.customer, e.equipment_name, e.serial, e.install_date, e.locked_at is not null as locked,
            (select d.id from directory_customers d where lower(d.name) = lower(e.customer) and d.archived = false order by d.id limit 1) as customer_id
       from account_equipment e
      where coalesce(e.serial_key, '') <> ''
        and e.serial_key in (select serial_key from account_equipment where coalesce(serial_key, '') <> '' group by serial_key having count(*) > 1)
      order by e.serial_key, lower(e.customer), e.id`,
  );
  const out: DuplicateSerial[] = [];
  for (const r of rows) {
    const unit = { id: Number(r.id), customer: r.customer, customerId: r.customer_id == null ? null : Number(r.customer_id), equipmentName: r.equipment_name, serial: r.serial, installDate: r.install_date, locked: !!r.locked };
    const last = out[out.length - 1];
    if (last && last.serialKey === r.serial_key) last.units.push(unit);
    else out.push({ serialKey: r.serial_key, units: [unit] });
  }
  return out;
}
