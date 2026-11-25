-- One Record Per Machine, phase M1 ("One Record Per Machine Plan", Chuy approved 11/24): one `machines` row per physical
-- machine, and a machine_id on every account unit, retired unit and warehouse machine record. Additive: every record and
-- every column it had stays; nothing reads machine_id yet. This file adds the table, the columns and the upkeep; 0144
-- fills in the records already there.
--
-- Which machine a record is (choices 3 and 4):
--   - A serial that counts (0137's katz_serial_key, and katz_serial_counts: no placeholders like "N/A") is one machine,
--     wherever it shows up: on an account, retired, or on warehouse records, sold or not.
--   - A record with no serial is its own machine.
--   - Bulk stock (a warehouse record with a quantity over 1 and no serial) and warehouse records of kind "module" have no
--     machine: bulk stays on the warehouse list (the plan), and modules are their own records (choice 6).
--
-- Upkeep, on every save that sets a serial or makes a record (the triggers below):
--   - A serial finds its machine, or makes one. A record whose serial changes to one no machine has yet keeps its
--     machine and gives it the new serial when no other record shares it (a typo fixed is the same machine); otherwise
--     it gets a new one.
--   - A record with no serial keeps the machine with no serial it has, or the one the save brings (Retire and Put Back
--     carry it), or gets a new one. Clearing a serial says it wasn't this record's (the install machine list moves a
--     serial typed on the wrong row this way), so the record leaves that serial's machine for one of its own.
--   - A merged duplicate with no serial is the machine of the unit it went into.
--   - Nothing here deletes a machine. A machine whose records all went to another is marked merged into it; one left
--     with no record otherwise (a serial cleared off its only record) is counted on Link Check.
--
-- None of the existing triggers fire on machine_id: the equipment history trigger records only its listed fields, the
-- serial guards fire on serial, serial_key and status, and the customer id triggers on the name.

set local lock_timeout = '15s';

create table if not exists machines (
  id            serial primary key,
  -- The serial key it's known by (null for a machine with no serial), and the serial as first seen.
  serial_key    text,
  serial        text,
  model         text,
  -- The record it was first seen on: 'account_equipment', 'assets' or 'account_equipment_retired', and its id.
  origin_table  text not null,
  origin_id     integer not null,
  -- Set when its records all went to another machine (a typo fixed on each of them, or a duplicate merged into another
  -- unit), so its history can follow them later. Nothing points at a merged machine.
  merged_into   integer references machines (id) on delete set null,
  created_at    timestamptz not null default now()
);
create unique index if not exists machines_serial_key_idx on machines (serial_key) where serial_key is not null;
create index if not exists machines_origin_idx on machines (origin_table, origin_id);

alter table account_equipment add column if not exists machine_id integer references machines (id) on delete set null;
alter table account_equipment_retired add column if not exists machine_id integer references machines (id) on delete set null;
alter table assets add column if not exists machine_id integer references machines (id) on delete set null;

-- True when a record other than the ones named has this machine.
create or replace function katz_machine_in_use(mid integer, skip_table text, skip_id integer, skip_unit integer default null)
returns boolean language sql stable as $$
  select exists (select 1 from account_equipment where machine_id = mid
                    and not (skip_table = 'account_equipment' and id = skip_id) and id is distinct from skip_unit)
      or exists (select 1 from assets where machine_id = mid and not (skip_table = 'assets' and id = skip_id))
      or exists (select 1 from account_equipment_retired where machine_id = mid
                    and not (skip_table = 'account_equipment_retired' and id = skip_id))
$$;

-- The machine a record belongs to. k: its serial key (null or not counting: no serial); given: the machine the save
-- brings or the record had; self_table, self_id: the record (so "no other record" leaves it out).
create or replace function katz_machine_for(k text, raw_serial text, model_name text, given integer, self_table text, self_id integer)
returns integer language plpgsql as $$
declare
  m integer;
begin
  if not katz_serial_counts(k) then
    -- Kept only when it's a machine with no serial. A serial cleared off a record says it isn't this machine's (the
    -- install list moves a serial typed on the wrong row this way), so the record leaves that serial's machine.
    if given is not null and exists (select 1 from machines where id = given and serial_key is null) then return given; end if;
    -- The record's own machine from before (it went bulk and back, or was put back under its id), else a new one.
    select id into m from machines
     where origin_table = self_table and origin_id = self_id and serial_key is null and merged_into is null
     order by id limit 1;
    if m is not null then return m; end if;
    insert into machines (serial_key, serial, model, origin_table, origin_id)
    values (null, nullif(btrim(coalesce(raw_serial, '')), ''), model_name, self_table, self_id)
    returning id into m;
    return m;
  end if;
  -- One save at a time per serial, so two at the same moment make one machine; and a machine being given a new serial
  -- holds still while it's read.
  perform pg_advisory_xact_lock(hashtext('katz-machine:' || k));
  select id into m from machines where serial_key = k for share;
  if m is not null then
    -- Its machine before, left with no record, went to this one (a typo fixed on each of its records).
    if given is not null and given <> m and not katz_machine_in_use(given, self_table, self_id) then
      update machines set merged_into = m where id = given and merged_into is null;
    end if;
    return m;
  end if;
  -- A serial no machine has yet: the record's own machine takes it, unless another record shares that machine.
  if given is not null and exists (select 1 from machines where id = given) and not katz_machine_in_use(given, self_table, self_id) then
    update machines set serial_key = k, serial = btrim(raw_serial) where id = given;
    return given;
  end if;
  insert into machines (serial_key, serial, model, origin_table, origin_id)
  values (k, btrim(raw_serial), model_name, self_table, self_id)
  returning id into m;
  return m;
end $$;

-- Account units: the key the desk stores (serial_key), else the serial's.
create or replace function katz_unit_machine() returns trigger language plpgsql as $$
begin
  new.machine_id := katz_machine_for(
    coalesce(nullif(new.serial_key, ''), katz_serial_key(new.serial)),
    new.serial,
    coalesce(nullif(btrim(new.catalog_model), ''), new.equipment_name),
    new.machine_id,
    tg_table_name,
    new.id);
  return new;
end $$;

-- Retired units: the same, and two more cases.
--   - A retire that doesn't send the machine (the code from before this, while a publish is in progress) takes it from
--     its copy of the unit.
--   - A duplicate with no serial merged into another unit is that unit's machine; its own machine, left with no
--     record, is marked merged into it.
create or replace function katz_retired_machine() returns trigger language plpgsql as $$
declare
  k text := coalesce(nullif(new.serial_key, ''), katz_serial_key(new.serial));
  target integer;
begin
  if tg_op = 'INSERT' and new.machine_id is null and jsonb_typeof(new.unit -> 'machine_id') = 'number' then
    new.machine_id := (new.unit ->> 'machine_id')::int;
  end if;
  if not katz_serial_counts(k) and coalesce(new.links ->> 'merged_into', '') ~ '^[0-9]+$' then
    select machine_id into target from account_equipment where id = (new.links ->> 'merged_into')::int;
    if target is not null then
      if new.machine_id is not null and new.machine_id <> target
         and not katz_machine_in_use(new.machine_id, 'account_equipment_retired', new.id, new.unit_id) then
        update machines set merged_into = target where id = new.machine_id and merged_into is null;
      end if;
      new.machine_id := target;
      return new;
    end if;
  end if;
  new.machine_id := katz_machine_for(k, new.serial, coalesce(nullif(btrim(new.catalog_model), ''), new.equipment_name), new.machine_id,
                                     'account_equipment_retired', new.id);
  return new;
end $$;

-- Warehouse records: bulk and modules have none.
create or replace function katz_asset_machine() returns trigger language plpgsql as $$
begin
  if new.kind = 'module' or (coalesce(new.qty, 1) > 1 and not katz_serial_counts(katz_serial_key(new.serial))) then
    new.machine_id := null;
    return new;
  end if;
  new.machine_id := katz_machine_for(katz_serial_key(new.serial), new.serial, new.model, new.machine_id, 'assets', new.id);
  return new;
end $$;

-- Named to run after account_equipment_serial_upper (triggers run in name order), so the machine keeps the serial as
-- the unit stores it.
drop trigger if exists account_equipment_zmachine on account_equipment;
create trigger account_equipment_zmachine before insert or update of serial, serial_key on account_equipment
  for each row execute function katz_unit_machine();
drop trigger if exists account_equipment_retired_zmachine on account_equipment_retired;
create trigger account_equipment_retired_zmachine before insert or update of serial, serial_key on account_equipment_retired
  for each row execute function katz_retired_machine();
drop trigger if exists assets_machine on assets;
create trigger assets_machine before insert or update of serial, qty, kind on assets
  for each row execute function katz_asset_machine();
