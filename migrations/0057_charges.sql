-- Charges on a service / TLC ticket: trip, labor and parts, priced from the NetSuite item list.
-- Katz Desk collects the charges; the Sales Order is still created in NetSuite (by the billing script).

-- NetSuite items a ticket can be billed with, keyed by the bare SKU as the NetSuite item export lists it
-- ("EVER104120"). `parent` is the NetSuite parent group when known ("PARTS"), so `item` reads the way it is keyed
-- on a Sales Order ("PARTS : EVER104120"). `rate` is the Base Price, `cost` the Purchase Price.
-- `mfr_part` is a manufacturer / vendor number used on tickets, when it differs from the SKU.
create table if not exists billing_items (
  id          serial primary key,
  sku         text not null,
  parent      text,
  item        text not null,
  description text,
  rate        numeric(12,2),
  cost        numeric(12,2),
  kind        text not null default 'part' check (kind in ('trip', 'labor', 'part', 'equipment', 'other')),
  mfr_part    text,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);
create unique index if not exists billing_items_sku_uidx on billing_items (lower(btrim(sku)));
create index if not exists billing_items_mfr_idx on billing_items (lower(btrim(mfr_part))) where mfr_part is not null;

-- Trip and labor are fixed rates and match NetSuite exactly.
insert into billing_items (sku, parent, item, description, rate, kind)
values
  ('TRIPCHARGE', 'Service', 'Service : TRIPCHARGE', 'Trip Charge for Service Call', 150.00, 'trip'),
  ('SERVICELABOR', 'Service', 'Service : SERVICELABOR', 'Service Labor Hour', 150.00, 'labor')
on conflict do nothing;

create table if not exists ticket_charges (
  id          serial primary key,
  job_id      int not null references service_jobs (id) on delete cascade,
  item        text not null,
  description text,
  qty         numeric(10,2) not null default 1 check (qty > 0),
  rate        numeric(12,2) not null default 0 check (rate >= 0),
  kind        text not null default 'part',
  sort        int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists ticket_charges_job_idx on ticket_charges (job_id, sort, id);

-- Billing state on the ticket itself.
alter table service_jobs add column if not exists po text;
alter table service_jobs add column if not exists ns_so text;
alter table service_jobs add column if not exists billed_at timestamptz;
