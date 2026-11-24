-- No new duplicate serials (Chuy, 11/23, after the duplicate-serial list was cleared). Only adds functions, triggers
-- and one index: no existing row changes, and serials already shared are left as they are (a save that doesn't change
-- a serial is never refused).
--
-- Two serials are the same when they read the same after trimming, spaces and "#", any case: the key the desk matches
-- by (serialKey in src/lib/ops/account-equip.ts). Placeholders ("N/A", "none", "-") and keys under 3 characters are no
-- serial, as on the duplicate list.
--
-- 1. Customer machines (account_equipment): a serial another customer machine has is refused.
-- 2. Warehouse records (assets): a serial another warehouse record that isn't sold has is refused. A sold record is
--    history: a machine that comes back for a rebuild gets a new record.
-- 3. A warehouse record and a customer machine with the same serial is how a sold or deployed machine reads: not refused.
--
-- The checks run when the save is committed (deferred constraint triggers), so one statement that takes a serial off
-- one unit and puts it on another passes. The error has SQLSTATE KZ001 (src/lib/ops/serial-guard.ts).

create or replace function katz_serial_key(raw text) returns text language sql immutable as $$
  select nullif(lower(regexp_replace(btrim(coalesce(raw, '')), '[#[:space:]​‌‍⁠﻿­]', '', 'g')), '')
$$;

-- A key that counts as a serial: not a placeholder, at least 3 characters.
create or replace function katz_serial_counts(k text) returns boolean language sql immutable as $$
  select k is not null and length(k) >= 3
     and k not in ('n/a', 'na', 'none', 'null', 'unknown', 'notavailable', 'notavail', '-', '—', '–')
$$;

create or replace function account_equipment_serial_guard() returns trigger language plpgsql as $$
declare
  k text := coalesce(nullif(new.serial_key, ''), katz_serial_key(new.serial));
  other record;
begin
  if not katz_serial_counts(k) then return null; end if;
  if tg_op = 'UPDATE' and coalesce(nullif(old.serial_key, ''), katz_serial_key(old.serial)) is not distinct from k then return null; end if;
  -- One save at a time per serial, so two at the same moment can't both land.
  perform pg_advisory_xact_lock(hashtext('katz-serial:' || k));
  -- The unit still has that serial when the save commits (a later statement may have changed or removed it).
  if not exists (select 1 from account_equipment where id = new.id and coalesce(nullif(serial_key, ''), katz_serial_key(serial)) = k) then
    return null;
  end if;
  select id, customer, coalesce(nullif(btrim(equipment_name), ''), catalog_model) as name into other
    from account_equipment
   where id <> new.id and (serial_key = k or (coalesce(serial_key, '') = '' and katz_serial_key(serial) = k))
   order by id
   limit 1;
  if found then
    raise exception using
      errcode = 'KZ001',
      message = format('Serial %s is already on %s (%s).', btrim(new.serial), other.customer, other.name),
      hint = 'Fix the serial, or move or remove that unit first.';
  end if;
  return null;
end $$;

drop trigger if exists account_equipment_serial_guard on account_equipment;
create constraint trigger account_equipment_serial_guard
  after insert or update of serial, serial_key on account_equipment
  deferrable initially deferred
  for each row execute function account_equipment_serial_guard();

create index if not exists assets_serial_key_idx on assets (katz_serial_key(serial)) where status <> 'sold';

create or replace function assets_serial_guard() returns trigger language plpgsql as $$
declare
  k text := katz_serial_key(new.serial);
  other record;
begin
  if new.status = 'sold' or not katz_serial_counts(k) then return null; end if;
  -- Refused only when the serial is new on the record, or a sold record comes back into stock.
  if tg_op = 'UPDATE' and katz_serial_key(old.serial) is not distinct from k and old.status <> 'sold' then return null; end if;
  perform pg_advisory_xact_lock(hashtext('katz-asset-serial:' || k));
  if not exists (select 1 from assets where id = new.id and status <> 'sold' and katz_serial_key(serial) = k) then
    return null;
  end if;
  select id, model, status, site into other
    from assets
   where id <> new.id and status <> 'sold' and katz_serial_key(serial) = k
   order by id
   limit 1;
  if found then
    raise exception using
      errcode = 'KZ001',
      message = format('Serial %s is already on warehouse record #%s (%s, %s at %s).', btrim(new.serial), other.id, other.model, other.status, other.site),
      hint = 'Fix the serial, or mark that record sold first.';
  end if;
  return null;
end $$;

drop trigger if exists assets_serial_guard on assets;
create constraint trigger assets_serial_guard
  after insert or update of serial, status on assets
  deferrable initially deferred
  for each row execute function assets_serial_guard();
