-- NetSuite's billing on installs and PMs (Grok's request through Chuy, 2026-11-05): Billing Backfill (NetSuite) now
-- matches a WO to an install or a PM too, not only to a service or TLC ticket. Nothing existing changes: the three new
-- tables and the run log start empty. Tickets keep theirs where they are (ticket_charges, service_jobs, ticket_invoices).
--
-- What KatzDesk bills an install or a PM stays in its Invoice window (invoices / invoice_lines). These tables hold what
-- NetSuite billed, read-only in KatzDesk: only the Admin's Billing Backfill writes them. Export Billing never reads them,
-- so lines brought back from NetSuite are never billed again.

-- One WO's NetSuite billing on an install or a PM: its Sales Order, the day it was billed, and NetSuite's header
-- discount on its lines (in dollars). An install can carry several WOs (install_work_orders), so one row per WO.
create table if not exists record_ns_billing (
  id             serial primary key,
  install_id     int references installs (id) on delete cascade,
  pm_id          int references pm_jobs (id) on delete cascade,
  -- "install:12" or "pm:7": the record, as one value the unique indexes and the backfill's upserts can use.
  record_key     text generated always as (
                   case when install_id is not null then 'install:' || install_id::text else 'pm:' || pm_id::text end
                 ) stored,
  wo             text not null,
  -- woMatchKey of the WO ("WO-0995" → "995").
  wo_key         text not null,
  ns_so          text,
  billed_at      timestamptz,
  discount_kind  text,
  discount_value numeric(12, 2),
  updated_by     text,
  updated_at     timestamptz not null default now(),
  constraint record_ns_billing_one_record check (num_nonnulls(install_id, pm_id) = 1),
  constraint record_ns_billing_discount_check check (
    (discount_kind is null and discount_value is null)
    or (discount_kind = 'percent' and discount_value > 0 and discount_value <= 100)
    or (discount_kind = 'amount' and discount_value > 0)
  )
);
create unique index if not exists record_ns_billing_wo_uidx on record_ns_billing (record_key, wo_key);
create index if not exists record_ns_billing_install_idx on record_ns_billing (install_id) where install_id is not null;
create index if not exists record_ns_billing_pm_idx on record_ns_billing (pm_id) where pm_id is not null;

-- That WO's lines as NetSuite billed them (credits netted against their item, as on tickets). Billed already.
create table if not exists record_ns_charges (
  id          serial primary key,
  billing_id  int not null references record_ns_billing (id) on delete cascade,
  item        text not null,
  description text,
  qty         numeric(10, 2) not null check (qty > 0),
  rate        numeric(12, 2) not null check (rate >= 0),
  kind        text not null default 'part',
  sort        int not null default 0
);
create index if not exists record_ns_charges_billing_idx on record_ns_charges (billing_id, sort, id);

-- One NetSuite invoice on an install or a PM, as ticket_invoices holds them for tickets: NetSuite's own status word
-- (never worked out from the amount remaining), its total after the header discount (no tax), what's left to pay, the
-- location it was billed from, and whether it came from a Sales Order or stands alone. wo_key: the WO it came in on.
create table if not exists record_ns_invoices (
  id               serial primary key,
  install_id       int references installs (id) on delete cascade,
  pm_id            int references pm_jobs (id) on delete cascade,
  record_key       text generated always as (
                     case when install_id is not null then 'install:' || install_id::text else 'pm:' || pm_id::text end
                   ) stored,
  wo_key           text,
  ns_invoice       text not null,
  ns_so            text,
  invoice_date     date,
  status           text not null,
  total            numeric(12, 2),
  amount_remaining numeric(12, 2),
  source           text not null default 'so' check (source in ('so', 'standalone')),
  location         text,
  added_by         text,
  added_at         timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint record_ns_invoices_one_record check (num_nonnulls(install_id, pm_id) = 1)
);
create unique index if not exists record_ns_invoices_uidx on record_ns_invoices (record_key, lower(btrim(ns_invoice)));
create index if not exists record_ns_invoices_invoice_idx on record_ns_invoices (lower(btrim(ns_invoice)));
create index if not exists record_ns_invoices_install_idx on record_ns_invoices (install_id) where install_id is not null;
create index if not exists record_ns_invoices_pm_idx on record_ns_invoices (pm_id) where pm_id is not null;

-- Each Billing Backfill Write: who, when, the files, the preview's counts and what was written.
create table if not exists billing_backfill_runs (
  id      serial primary key,
  run_at  timestamptz not null default now(),
  run_by  text,
  files   text,
  wos     int,
  counts  jsonb,
  written jsonb
);
create index if not exists billing_backfill_runs_at_idx on billing_backfill_runs (run_at desc);
