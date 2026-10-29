-- NetSuite invoices on tickets, the invoice lock, and what the Corrigo import keeps (Grok's billing request through
-- Chuy, 2026-10-28). Nothing existing changes: the new table starts empty and every new column starts blank.

-- One NetSuite invoice on a service or TLC ticket. A ticket can have several (an SO invoiced twice, a standalone
-- invoice, a voided one). `status` is NetSuite's own word (Open, Paid, Voided, ...), never worked out from
-- amount_remaining. `source` says whether the invoice came from a Sales Order or stands alone. `location` is the
-- NetSuite location it was billed from (Houston - WH, San Antonio WH, Dallas WH).
create table if not exists ticket_invoices (
  id               serial primary key,
  job_id           int not null references service_jobs (id) on delete cascade,
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
  updated_at       timestamptz not null default now()
);
create unique index if not exists ticket_invoices_job_invoice_uidx on ticket_invoices (job_id, lower(btrim(ns_invoice)));
create index if not exists ticket_invoices_invoice_idx on ticket_invoices (lower(btrim(ns_invoice)));

-- A ticket with an invoice that isn't Voided is locked: charges, P.O., discount and Sales Order. An Admin can unlock it
-- with a reason (who, when and why go on the ticket's history); saving locks it again.
alter table service_jobs add column if not exists billing_unlocked_at timestamptz;
alter table service_jobs add column if not exists billing_unlocked_by text;
alter table service_jobs add column if not exists billing_unlock_reason text;

-- From the Corrigo report: Corrigo's own work order id (when the report has one), the Service Location Name as
-- written, and the net Corrigo billed ("Total Invoice"), for the account and amount checks.
alter table service_jobs add column if not exists corrigo_id text;
alter table service_jobs add column if not exists service_location text;
alter table service_jobs add column if not exists corrigo_net numeric(12, 2);
alter table pm_jobs add column if not exists corrigo_id text;
alter table pm_jobs add column if not exists service_location text;
create index if not exists service_jobs_corrigo_id_idx on service_jobs (corrigo_id) where corrigo_id is not null;
