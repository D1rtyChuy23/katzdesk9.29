-- Work order history (Chuy, 2026-10-27): completed work orders from the old ticket system (2024–2026) with their
-- QuickBooks invoice lines, imported once from two CSVs (Tickets → Import → Work Order History). History is kept in
-- its own tables, read-only: it never writes ticket Charges or invoices, so billing, Approve and Parts Profit are
-- unchanged. Nothing existing changes: the new columns start blank and the new tables start empty.

-- An account renamed from a QuickBooks child name ("Walk - In:Water Oak Cafe and Bakery" → "Water Oak Cafe and
-- Bakery") keeps where it was billed: the parent name, and whether that parent is a Walk-In.
alter table directory_customers add column if not exists parent_account text;
alter table directory_customers add column if not exists walk_in boolean not null default false;

-- One line per import: who, when, what the preview counted, what was saved, and whether it was undone.
create table if not exists wo_history_runs (
  id           serial primary key,
  filename     text,
  row_count    int not null default 0,
  counts       jsonb,
  created      int not null default 0,
  attached     int not null default 0,
  lines        int not null default 0,
  created_by   text,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  undone_at    timestamptz,
  undone_by    text
);

-- One completed work order. `customer` is the KatzDesk account it is saved on; `job_id` is the KatzDesk ticket it
-- was attached to, when one already had this WO. `filled_*` are the blank ticket fields this import filled, so Undo
-- can clear exactly those.
create table if not exists wo_history (
  id                 serial primary key,
  run_id             int not null references wo_history_runs (id) on delete cascade,
  history_ref        text not null,
  wo                 text,
  completed          timestamp,
  customer           text not null,
  file_customer      text,
  service_location   text,
  location_source    text,
  location_needed    boolean not null default false,
  technician         text,
  original_tech      text,
  call_category      text,
  service_type       text,
  problem            text,
  work_done          text,
  parts_used         text,
  labor_hours        numeric(10, 2),
  trip_charges       numeric(10, 2),
  parts_amount       numeric(12, 2),
  invoice_total      numeric(12, 2),
  po                 text,
  invoice_date       date,
  has_items          text,
  review_flags       text,
  -- From the item lines: the discount (a positive number) and the line total after it.
  discount           numeric(12, 2),
  lines_total        numeric(12, 2),
  job_id             int references service_jobs (id) on delete set null,
  filled_work_done   text,
  filled_completed   date,
  created_at         timestamptz not null default now()
);
create unique index if not exists wo_history_ref_uidx on wo_history (history_ref);
create index if not exists wo_history_customer_idx on wo_history (lower(btrim(customer)));
create index if not exists wo_history_job_idx on wo_history (job_id) where job_id is not null;
create index if not exists wo_history_run_idx on wo_history (run_id);

-- The QuickBooks invoice lines, exactly as billed. Qty and price can be blank or zero; Amount is what was billed.
create table if not exists wo_history_lines (
  id                serial primary key,
  history_id        int not null references wo_history (id) on delete cascade,
  sort              int not null default 0,
  line_type         text not null,
  kind              text not null,
  item_code         text,
  description       text,
  item_class        text,
  item_group        text,
  qty               numeric(12, 2),
  unit_price        numeric(12, 2),
  amount            numeric(12, 2),
  invoice_date      date,
  invoice_customer  text
);
create index if not exists wo_history_lines_history_idx on wo_history_lines (history_id, sort, id);
