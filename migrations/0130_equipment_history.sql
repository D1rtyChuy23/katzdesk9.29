-- Equipment change history, reversible removal from an install, and move requests (Chuy, 11/19, after Lopez Mexican
-- Restaurant install #191 lost two units with no trace). Only adds tables and triggers: no existing row changes.

-- Every create, update, move, retire, put-back and remove of an account unit, and every add or removal of a unit on an
-- install, one row per field: who, when, field, old value, new value. Written by the triggers below, so no path that
-- writes a unit can skip it. Append-only: a trigger refuses any update or delete of a row.
create table if not exists equipment_history (
  id          bigserial primary key,
  at          timestamptz not null default now(),
  unit_id     int,
  install_id  int,
  customer    text,
  action      text not null,
  field       text,
  old_value   text,
  new_value   text,
  actor       text not null default 'System',
  note        text
);
create index if not exists equipment_history_unit_idx on equipment_history (unit_id, at desc) where unit_id is not null;
create index if not exists equipment_history_install_idx on equipment_history (install_id, at desc) where install_id is not null;

create or replace function equipment_history_keep() returns trigger language plpgsql as $$
begin
  raise exception 'equipment history is append-only';
end $$;
drop trigger if exists equipment_history_keep on equipment_history;
create trigger equipment_history_keep before update or delete on equipment_history for each row execute function equipment_history_keep();

-- Who and what, set by the statement that writes (src/lib/ops/unit-history.ts): katz.actor, and katz.action when the
-- write is a move, retire or put-back. Unset (a path that doesn't name anyone) records System.
create or replace function equipment_history_actor() returns text language sql stable as $$
  select coalesce(nullif(current_setting('katz.actor', true), ''), 'System')
$$;
create or replace function equipment_history_action(fallback text) returns text language sql stable as $$
  select coalesce(nullif(current_setting('katz.action', true), ''), fallback)
$$;

create or replace function equipment_history_unit() returns trigger language plpgsql as $$
declare
  who text := equipment_history_actor();
  f text;
  o text;
  n text;
  fields text[] := array['customer', 'catalog_model', 'equipment_name', 'serial', 'part_number', 'ownership', 'install_date', 'condition', 'electrical', 'locked'];
begin
  if tg_op = 'INSERT' then
    foreach f in array fields loop
      n := case f
        when 'customer' then new.customer when 'catalog_model' then new.catalog_model when 'equipment_name' then new.equipment_name
        when 'serial' then new.serial when 'part_number' then new.part_number when 'ownership' then new.ownership
        when 'install_date' then new.install_date::text when 'condition' then new.condition when 'electrical' then new.electrical
        when 'locked' then case when new.locked_at is not null then 'Locked by ' || coalesce(new.locked_by, '?') end end;
      if n is not null and n <> '' then
        insert into equipment_history (unit_id, install_id, customer, action, field, old_value, new_value, actor)
        values (new.id, new.created_by_install, new.customer, equipment_history_action('create'), f, null, n, who);
      end if;
    end loop;
    return new;
  elsif tg_op = 'UPDATE' then
    foreach f in array fields loop
      o := case f
        when 'customer' then old.customer when 'catalog_model' then old.catalog_model when 'equipment_name' then old.equipment_name
        when 'serial' then old.serial when 'part_number' then old.part_number when 'ownership' then old.ownership
        when 'install_date' then old.install_date::text when 'condition' then old.condition when 'electrical' then old.electrical
        when 'locked' then case when old.locked_at is not null then 'Locked by ' || coalesce(old.locked_by, '?') end end;
      n := case f
        when 'customer' then new.customer when 'catalog_model' then new.catalog_model when 'equipment_name' then new.equipment_name
        when 'serial' then new.serial when 'part_number' then new.part_number when 'ownership' then new.ownership
        when 'install_date' then new.install_date::text when 'condition' then new.condition when 'electrical' then new.electrical
        when 'locked' then case when new.locked_at is not null then 'Locked by ' || coalesce(new.locked_by, '?') end end;
      if o is distinct from n then
        insert into equipment_history (unit_id, customer, action, field, old_value, new_value, actor)
        values (new.id, new.customer, equipment_history_action(case when f = 'customer' then 'move' else 'update' end), f, o, n, who);
      end if;
    end loop;
    return new;
  else
    insert into equipment_history (unit_id, customer, action, field, old_value, new_value, actor, note)
    values (old.id, old.customer, equipment_history_action('remove'), null,
            concat_ws(' · ', old.equipment_name, case when old.serial is not null then 'SN ' || old.serial end), null, who,
            case when exists (select 1 from account_equipment_retired r where r.unit_id = old.id) then 'Kept: it can be put back' end);
    return old;
  end if;
end $$;
drop trigger if exists equipment_history_unit on account_equipment;
create trigger equipment_history_unit after insert or update or delete on account_equipment for each row execute function equipment_history_unit();

-- A unit added to or taken off an install's visit, and its kind on the pre-inspection.
create or replace function equipment_history_visit() returns trigger language plpgsql as $$
declare
  who text := equipment_history_actor();
  r record;
  label text;
begin
  r := case when tg_op = 'DELETE' then old else new end;
  select concat_ws(' · ', a.equipment_name, case when a.serial is not null then 'SN ' || a.serial end) into label from account_equipment a where a.id = r.equipment_id;
  if tg_op = 'INSERT' then
    insert into equipment_history (unit_id, install_id, customer, action, field, old_value, new_value, actor)
    values (new.equipment_id, new.install_id, (select customer from installs where id = new.install_id), equipment_history_action('add_to_install'), 'install', null, label, who);
  elsif tg_op = 'DELETE' then
    insert into equipment_history (unit_id, install_id, customer, action, field, old_value, new_value, actor)
    values (old.equipment_id, old.install_id, (select customer from installs where id = old.install_id), equipment_history_action('remove_from_install'), 'install', label, null, who);
  elsif old.visit_kind is distinct from new.visit_kind then
    insert into equipment_history (unit_id, install_id, customer, action, field, old_value, new_value, actor)
    values (new.equipment_id, new.install_id, (select customer from installs where id = new.install_id), 'update', 'visit_kind', old.visit_kind, new.visit_kind, who);
  end if;
  return r;
end $$;
drop trigger if exists equipment_history_visit on install_inspection_units;
create trigger equipment_history_visit after insert or update or delete on install_inspection_units for each row execute function equipment_history_visit();

-- An install's equipment list (installs.machines), one line per row: "Model SN x".
create or replace function equipment_list_text(m text) returns text language plpgsql immutable as $$
begin
  if m is null or btrim(m) = '' then return null; end if;
  return (select string_agg(concat_ws(' SN ', nullif(btrim(e->>'equipment'), ''), nullif(btrim(e->>'serial'), '')), E'\n' order by ord)
            from jsonb_array_elements(m::jsonb) with ordinality as x(e, ord));
exception when others then
  return left(m, 2000);
end $$;
create or replace function equipment_history_install_list() returns trigger language plpgsql as $$
declare
  o text := equipment_list_text(old.machines);
  n text := equipment_list_text(new.machines);
begin
  if o is distinct from n then
    insert into equipment_history (install_id, customer, action, field, old_value, new_value, actor)
    values (new.id, new.customer, 'update', 'equipment list', o, n, equipment_history_actor());
  end if;
  return new;
end $$;
drop trigger if exists equipment_history_install_list on installs;
create trigger equipment_history_install_list after update of machines on installs for each row execute function equipment_history_install_list();

-- A unit taken off an install's list: what was there, so Put back returns it (the unit stays on the account).
create table if not exists install_units_removed (
  id            serial primary key,
  install_id    int not null,
  unit_id       int not null,
  list_row      jsonb not null,
  links         jsonb not null default '{}'::jsonb,
  removed_at    timestamptz not null default now(),
  removed_by    text,
  put_back_at   timestamptz,
  put_back_by   text
);
create index if not exists install_units_removed_install_idx on install_units_removed (install_id) where put_back_at is null;

-- A move of a unit to another account asked for by someone who isn't an Admin; an Admin confirms or declines it.
create table if not exists equipment_move_requests (
  id              serial primary key,
  unit_id         int not null,
  from_customer   text not null,
  to_customer     text not null,
  to_install_id   int,
  serial          text not null,
  machine_index   int,
  asked_by        text not null,
  asked_at        timestamptz not null default now(),
  note            text,
  decided_at      timestamptz,
  decided_by      text,
  decision        text check (decision in ('confirmed', 'declined'))
);
create index if not exists equipment_move_requests_open_idx on equipment_move_requests (asked_at) where decided_at is null;

-- Serials are kept uppercase (11/19). Only a serial being written changes: an edit of another field leaves an older
-- mixed-case serial as it is, and so does Put back. The Admin's previewed Normalize changes the existing ones.
create or replace function account_equipment_serial_upper() returns trigger language plpgsql as $$
begin
  if coalesce(current_setting('katz.action', true), '') = 'put_back' then return new; end if;
  if tg_op = 'INSERT' or new.serial is distinct from old.serial then
    new.serial := nullif(upper(btrim(regexp_replace(normalize(coalesce(new.serial, ''), NFKC), '[\u200B-\u200D\u2060\uFEFF\u00AD]', '', 'g'))), '');
  end if;
  return new;
end $$;
drop trigger if exists account_equipment_serial_upper on account_equipment;
create trigger account_equipment_serial_upper before insert or update of serial on account_equipment for each row execute function account_equipment_serial_upper();
