-- Machines taken off an account (Chuy, 11/9): Remove used to delete the unit with its inspection history. The unit
-- still leaves account_equipment, so nothing that reads the account's machines changes; its record, and the
-- inspection and PM links it had, are kept here and can be put back. Only adds this table: no existing row changes.
create table if not exists account_equipment_retired (
  id              serial primary key,
  unit_id         int not null,
  customer        text not null,
  catalog_model   text not null,
  equipment_name  text not null,
  serial          text,
  serial_key      text,
  install_date    date,
  electrical      text,
  ownership       text,
  part_number     text,
  unit            jsonb not null,
  links           jsonb not null default '{}'::jsonb,
  retired_at      timestamptz not null default now(),
  retired_by      text,
  retired_name    text
);
create index if not exists account_equipment_retired_customer_idx on account_equipment_retired (lower(customer));
