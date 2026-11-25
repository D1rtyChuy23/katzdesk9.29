-- One Record Per Machine, phase M1, part 2: a machine for every record already there, by the rule in 0143. Its own file
-- so 0143's table locks are short. Each update writes only machine_id, so no record trigger runs its logic (the
-- machine, serial and customer id triggers fire on other columns; the equipment history trigger finds no listed field
-- changed and writes nothing) and no serial, name or date changes.
--
-- First seen: an account unit before a warehouse record before a retired unit, then the lowest id. That record gives a
-- machine its serial as written and its model.

set local lock_timeout = '15s';
-- The three tables hold still while their machines are made (reads go on; saves wait the few seconds this takes).
lock table account_equipment, assets, account_equipment_retired in share mode;

-- 1. One machine per serial.
insert into machines (serial_key, serial, model, origin_table, origin_id)
select k, btrim(serial), model, t, id
  from (
    select distinct on (k) k, serial, model, t, id
      from (
        select coalesce(nullif(serial_key, ''), katz_serial_key(serial)) as k, serial,
               coalesce(nullif(btrim(catalog_model), ''), equipment_name) as model, 'account_equipment' as t, id, 1 as first
          from account_equipment where machine_id is null
        union all
        select katz_serial_key(serial), serial, model, 'assets', id, 2
          from assets where machine_id is null and kind <> 'module'
        union all
        select coalesce(nullif(serial_key, ''), katz_serial_key(serial)), serial,
               coalesce(nullif(btrim(catalog_model), ''), equipment_name), 'account_equipment_retired', id, 3
          from account_equipment_retired where machine_id is null
      ) r
     where katz_serial_counts(k)
     order by k, first, id
  ) f
on conflict (serial_key) where serial_key is not null do nothing;

update account_equipment a set machine_id = m.id
  from machines m
 where a.machine_id is null and m.serial_key = coalesce(nullif(a.serial_key, ''), katz_serial_key(a.serial))
   and katz_serial_counts(coalesce(nullif(a.serial_key, ''), katz_serial_key(a.serial)));
update assets a set machine_id = m.id
  from machines m
 where a.machine_id is null and a.kind <> 'module' and m.serial_key = katz_serial_key(a.serial)
   and katz_serial_counts(katz_serial_key(a.serial));
update account_equipment_retired r set machine_id = m.id
  from machines m
 where r.machine_id is null and m.serial_key = coalesce(nullif(r.serial_key, ''), katz_serial_key(r.serial))
   and katz_serial_counts(coalesce(nullif(r.serial_key, ''), katz_serial_key(r.serial)));

-- 2. One machine per account unit with no serial.
insert into machines (serial_key, serial, model, origin_table, origin_id)
select null, nullif(btrim(coalesce(serial, '')), ''), coalesce(nullif(btrim(catalog_model), ''), equipment_name), 'account_equipment', id
  from account_equipment where machine_id is null
 order by id;
update account_equipment a set machine_id = m.id
  from machines m
 where a.machine_id is null and m.serial_key is null and m.origin_table = 'account_equipment' and m.origin_id = a.id;

-- 3. One per warehouse machine record with no serial (not bulk, not a module).
insert into machines (serial_key, serial, model, origin_table, origin_id)
select null, nullif(btrim(coalesce(serial, '')), ''), model, 'assets', id
  from assets where machine_id is null and kind <> 'module' and coalesce(qty, 1) <= 1
 order by id;
update assets a set machine_id = m.id
  from machines m
 where a.machine_id is null and m.serial_key is null and m.origin_table = 'assets' and m.origin_id = a.id;

-- 4. A retired unit with no serial: the machine of the unit it was merged into, else of its own unit if that unit is
--    on an account again, else its own.
update account_equipment_retired r set machine_id = a.machine_id
  from account_equipment a
 where r.machine_id is null and coalesce(r.links ->> 'merged_into', '') ~ '^[0-9]+$'
   and a.id = (r.links ->> 'merged_into')::int and a.machine_id is not null;
update account_equipment_retired r set machine_id = a.machine_id
  from account_equipment a
 where r.machine_id is null and a.id = r.unit_id and a.machine_id is not null;
insert into machines (serial_key, serial, model, origin_table, origin_id)
select null, nullif(btrim(coalesce(serial, '')), ''), coalesce(nullif(btrim(catalog_model), ''), equipment_name), 'account_equipment_retired', id
  from account_equipment_retired where machine_id is null
 order by id;
update account_equipment_retired r set machine_id = m.id
  from machines m
 where r.machine_id is null and m.serial_key is null and m.origin_table = 'account_equipment_retired' and m.origin_id = r.id;

-- The machine_id indexes after the fill, so the fill doesn't keep them up row by row.
create index if not exists account_equipment_machine_idx on account_equipment (machine_id);
create index if not exists account_equipment_retired_machine_idx on account_equipment_retired (machine_id);
create index if not exists assets_machine_idx on assets (machine_id) where machine_id is not null;
