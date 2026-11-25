-- One Record Per Machine, phase M2 ("One Record Per Machine Plan", Chuy approved 11/24): the rows that name one of a
-- machine's records get the machine itself. Additive: every link these rows have stays and every screen still reads it;
-- nothing reads machine_id yet. This file adds the columns and the upkeep; 0148 fills in the rows already there.
--
-- Which machine, from the row's own link (katz_link_machine_of below):
--   ticket_units.account_equipment_id, install_inspection_units.equipment_id (an install's machine list),
--   pm_runbook_unit_links.account_equipment_id   → that account unit's machine (these rows go when the unit does).
--   pm_runbook_units: unit_key "acct:<unit>"     → that unit's machine, else its serial_key's; any other key → its
--                                                  serial's (the key is the serial key), "piece:…" with none → none.
--   machine_parts (a PM's parts per machine)      → its unit's machine, else its serial_key's.
--   modules.assigned_unit_id (an Eversys module)  → the unit's machine; on no unit, none.
--   equipment_move_requests.unit_id               → the unit's machine, else its serial's.
--   rebuild_machines.asset_id                     → the warehouse record's machine, else its serial's; else none.
-- A serial's machine: the one with that serial key (0137), when the serial counts (no placeholders), or the machine
-- it was merged into.
--
-- A unit that's gone is found on the Retired list (its machine stays there). When the link still finds no machine, a PM
-- part, a PM runbook unit and a move request keep the machine they had (the part went into that machine, the request
-- was about it), and so does a module whose unit is gone. A module taken off its unit has none.
--
-- Upkeep: each row's trigger on its own link. And the rows follow:
--   - an account unit or a warehouse record that changes machine (its serial became another machine's), or a unit put
--     back under its id: the rows linked to it;
--   - a machine merged into another (0143: a typo fixed on its only record): every row on it;
--   - a machine that gets a serial (made, or re-keyed): the rows held by that serial with no machine yet (a rebuild or
--     PM part typed before any record had the serial).
-- Those updates write only machine_id, so no other trigger records anything (the install visit history records adds,
-- removals and the visit kind; the customer id triggers fire on names).

set local lock_timeout = '15s';

alter table ticket_units add column if not exists machine_id integer references machines (id) on delete set null;
alter table install_inspection_units add column if not exists machine_id integer references machines (id) on delete set null;
alter table pm_runbook_unit_links add column if not exists machine_id integer references machines (id) on delete set null;
alter table pm_runbook_units add column if not exists machine_id integer references machines (id) on delete set null;
alter table machine_parts add column if not exists machine_id integer references machines (id) on delete set null;
alter table modules add column if not exists machine_id integer references machines (id) on delete set null;
alter table equipment_move_requests add column if not exists machine_id integer references machines (id) on delete set null;
alter table rebuild_machines add column if not exists machine_id integer references machines (id) on delete set null;

-- An account unit's machine; for a unit that's been retired, its retired record's (Retire keeps the machine, and Put
-- Back brings it back under the same id).
-- ($1, not a name: the retired table has a column called unit.)
create or replace function katz_unit_machine_id(unit_ref integer) returns integer language sql stable as $$
  select coalesce(
    (select machine_id from account_equipment where id = $1),
    (select machine_id from account_equipment_retired where unit_id = $1 and machine_id is not null order by id desc limit 1))
$$;

-- A serial's machine, when the serial counts.
create or replace function katz_serial_machine(raw text) returns integer language sql stable as $$
  select coalesce(m.merged_into, m.id) from machines m
   where katz_serial_counts(katz_serial_key(raw)) and m.serial_key = katz_serial_key(raw)
$$;

-- The machine a row's own link gives (r: the row as jsonb), or null when it gives none. Link Check counts by this too.
create or replace function katz_link_machine_of(tbl text, r jsonb) returns integer language plpgsql stable as $$
begin
  case tbl
  when 'ticket_units', 'pm_runbook_unit_links' then
    return katz_unit_machine_id((r ->> 'account_equipment_id')::int);
  when 'install_inspection_units' then
    return katz_unit_machine_id((r ->> 'equipment_id')::int);
  when 'pm_runbook_units' then
    if coalesce(r ->> 'unit_key', '') ~ '^acct:[0-9]{1,9}$' then
      return coalesce(katz_unit_machine_id(substring(r ->> 'unit_key' from 6)::int), katz_serial_machine(r ->> 'serial_key'));
    end if;
    return katz_serial_machine(coalesce(nullif(r ->> 'serial_key', ''),
                                        case when coalesce(r ->> 'unit_key', '') !~ '^(acct|piece):' then r ->> 'unit_key' end));
  when 'machine_parts' then
    return coalesce(katz_unit_machine_id((r ->> 'account_equipment_id')::int), katz_serial_machine(r ->> 'serial_key'));
  when 'modules' then
    return katz_unit_machine_id((r ->> 'assigned_unit_id')::int);
  when 'equipment_move_requests' then
    return coalesce(katz_unit_machine_id((r ->> 'unit_id')::int), katz_serial_machine(r ->> 'serial'));
  when 'rebuild_machines' then
    return coalesce((select machine_id from assets where id = (r ->> 'asset_id')::int), katz_serial_machine(r ->> 'serial'));
  else
    return null;
  end case;
end $$;

create or replace function katz_link_machine() returns trigger language plpgsql as $$
declare
  m integer := katz_link_machine_of(tg_table_name, to_jsonb(new));
begin
  if m is null and tg_op = 'UPDATE' then
    if tg_table_name in ('machine_parts', 'equipment_move_requests', 'pm_runbook_units') then
      m := old.machine_id;
    elsif tg_table_name = 'modules' then
      -- Still on the same unit, which is gone: the machine it was on. Taken off, or onto a unit with none: none.
      if new.assigned_unit_id is not null and new.assigned_unit_id = old.assigned_unit_id then m := old.machine_id; end if;
    end if;
  end if;
  new.machine_id := m;
  return new;
end $$;

drop trigger if exists ticket_units_machine on ticket_units;
create trigger ticket_units_machine before insert or update of account_equipment_id on ticket_units
  for each row execute function katz_link_machine();
drop trigger if exists install_inspection_units_machine on install_inspection_units;
create trigger install_inspection_units_machine before insert or update of equipment_id on install_inspection_units
  for each row execute function katz_link_machine();
drop trigger if exists pm_runbook_unit_links_machine on pm_runbook_unit_links;
create trigger pm_runbook_unit_links_machine before insert or update of account_equipment_id on pm_runbook_unit_links
  for each row execute function katz_link_machine();
drop trigger if exists pm_runbook_units_machine on pm_runbook_units;
create trigger pm_runbook_units_machine before insert or update of unit_key, serial_key on pm_runbook_units
  for each row execute function katz_link_machine();
drop trigger if exists machine_parts_machine on machine_parts;
create trigger machine_parts_machine before insert or update of account_equipment_id, serial_key on machine_parts
  for each row execute function katz_link_machine();
drop trigger if exists modules_machine on modules;
create trigger modules_machine before insert or update of assigned_unit_id on modules
  for each row execute function katz_link_machine();
drop trigger if exists equipment_move_requests_machine on equipment_move_requests;
create trigger equipment_move_requests_machine before insert or update of unit_id, serial on equipment_move_requests
  for each row execute function katz_link_machine();
drop trigger if exists rebuild_machines_machine on rebuild_machines;
create trigger rebuild_machines_machine before insert or update of asset_id, serial on rebuild_machines
  for each row execute function katz_link_machine();

-- An account unit that changes machine, or comes back under its id (Put Back), takes the rows linked to it along. On
-- every update, not "update of machine_id": the machine usually changes in the unit's own trigger (a serial edit), and
-- a column trigger doesn't see that.
create or replace function katz_unit_machine_follow() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.machine_id is not distinct from old.machine_id then return null; end if;
  if new.machine_id is null then return null; end if;
  update ticket_units set machine_id = new.machine_id where account_equipment_id = new.id and machine_id is distinct from new.machine_id;
  update install_inspection_units set machine_id = new.machine_id where equipment_id = new.id and machine_id is distinct from new.machine_id;
  update pm_runbook_unit_links set machine_id = new.machine_id where account_equipment_id = new.id and machine_id is distinct from new.machine_id;
  update pm_runbook_units set machine_id = new.machine_id where unit_key = 'acct:' || new.id and machine_id is distinct from new.machine_id;
  update machine_parts set machine_id = new.machine_id where account_equipment_id = new.id and machine_id is distinct from new.machine_id;
  update modules set machine_id = new.machine_id where assigned_unit_id = new.id and machine_id is distinct from new.machine_id;
  update equipment_move_requests set machine_id = new.machine_id where unit_id = new.id and machine_id is distinct from new.machine_id;
  return null;
end $$;
drop trigger if exists account_equipment_machine_follow on account_equipment;
create trigger account_equipment_machine_follow after insert or update on account_equipment
  for each row execute function katz_unit_machine_follow();

-- So does a warehouse record, for the rebuild machines it went onto.
create or replace function katz_asset_machine_follow() returns trigger language plpgsql as $$
begin
  if new.machine_id is not distinct from old.machine_id then return null; end if;
  -- A record that has none now (it became bulk or a module) leaves each rebuild machine its serial's.
  update rebuild_machines r set machine_id = coalesce(new.machine_id, katz_serial_machine(r.serial))
   where r.asset_id = new.id and r.machine_id is distinct from coalesce(new.machine_id, katz_serial_machine(r.serial));
  return null;
end $$;
drop trigger if exists assets_machine_follow on assets;
create trigger assets_machine_follow after update on assets
  for each row execute function katz_asset_machine_follow();

-- A machine merged into another: every row on it moves to that one.
create or replace function katz_machine_merged_follow() returns trigger language plpgsql as $$
begin
  if new.merged_into is null or new.merged_into is not distinct from old.merged_into then return null; end if;
  update ticket_units set machine_id = new.merged_into where machine_id = new.id;
  update install_inspection_units set machine_id = new.merged_into where machine_id = new.id;
  update pm_runbook_unit_links set machine_id = new.merged_into where machine_id = new.id;
  update pm_runbook_units set machine_id = new.merged_into where machine_id = new.id;
  update machine_parts set machine_id = new.merged_into where machine_id = new.id;
  update modules set machine_id = new.merged_into where machine_id = new.id;
  update equipment_move_requests set machine_id = new.merged_into where machine_id = new.id;
  update rebuild_machines set machine_id = new.merged_into where machine_id = new.id;
  return null;
end $$;
drop trigger if exists machines_merged_follow on machines;
create trigger machines_merged_follow after update of merged_into on machines
  for each row execute function katz_machine_merged_follow();

-- A machine that gets a serial: the rows held by that serial with no machine yet take it.
create or replace function katz_machine_serial_follow() returns trigger language plpgsql as $$
begin
  if new.serial_key is null or new.merged_into is not null then return null; end if;
  if tg_op = 'UPDATE' and new.serial_key is not distinct from old.serial_key then return null; end if;
  update pm_runbook_units t set machine_id = new.id
   where t.machine_id is null and katz_serial_key(coalesce(nullif(t.serial_key, ''), t.unit_key)) = new.serial_key
     and katz_link_machine_of('pm_runbook_units', to_jsonb(t)) = new.id;
  update machine_parts t set machine_id = new.id
   where t.machine_id is null and katz_serial_key(t.serial_key) = new.serial_key
     and katz_link_machine_of('machine_parts', to_jsonb(t)) = new.id;
  update equipment_move_requests t set machine_id = new.id
   where t.machine_id is null and katz_serial_key(t.serial) = new.serial_key
     and katz_link_machine_of('equipment_move_requests', to_jsonb(t)) = new.id;
  update rebuild_machines t set machine_id = new.id
   where t.machine_id is null and katz_serial_key(t.serial) = new.serial_key
     and katz_link_machine_of('rebuild_machines', to_jsonb(t)) = new.id;
  return null;
end $$;
drop trigger if exists machines_serial_follow on machines;
create trigger machines_serial_follow after insert or update of serial_key on machines
  for each row execute function katz_machine_serial_follow();
