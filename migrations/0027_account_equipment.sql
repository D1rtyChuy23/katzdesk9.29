-- Equipment sitting at customer accounts (import list). Does not create tickets.

create table if not exists account_equipment (
  id              serial primary key,
  customer        text not null,
  catalog_model   text not null,
  equipment_name  text not null,
  serial          text,
  serial_key      text,
  install_date    date,
  electrical      text,
  ownership       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists account_equipment_customer_idx
  on account_equipment (lower(customer));
create index if not exists account_equipment_serial_idx
  on account_equipment (serial_key)
  where serial_key is not null and serial_key <> '';
create index if not exists account_equipment_model_idx
  on account_equipment (lower(catalog_model));
