-- Work Order History, a later run fills blanks and adds missing lines on saved work orders, and restores removed
-- accounts as Retired (Jesus, 2026-11-19). Additive only: new nullable columns and new empty tables. No existing row
-- is backfilled or changed. (0130 is taken by the equipment history PR.)

-- The run that added a line to an already-saved work order. Null for lines saved with their work order (Undo of that
-- run deletes the work order, and its lines with it). Undo of a later run deletes only the lines it added.
alter table wo_history_lines add column if not exists run_id int references wo_history_runs (id) on delete set null;
create index if not exists wo_history_lines_run_idx on wo_history_lines (run_id) where run_id is not null;

-- Each blank field a run filled, on a saved history row (target 'history') or on its ticket (target 'ticket'), with
-- the value before (blank) and the value written. Undo puts a field back only while it still holds what the run wrote.
-- Also the discount and line total a run recomputed after adding lines, so Undo can put those back.
create table if not exists wo_history_fills (
  id          serial primary key,
  run_id      int not null references wo_history_runs (id) on delete cascade,
  target      text not null check (target in ('history', 'ticket')),
  history_id  int references wo_history (id) on delete set null,
  job_id      int references service_jobs (id) on delete cascade,
  field       text not null,
  old_value   text,
  new_value   text,
  created_at  timestamptz not null default now()
);
create index if not exists wo_history_fills_run_idx on wo_history_fills (run_id);

-- Each removed account a run restored as Retired (archived = false, inactive = true), and whether it was already
-- inactive before. Undo removes it again only if it is still Retired from this run and nothing was added to it since.
create table if not exists wo_history_retired (
  id            serial primary key,
  run_id        int not null references wo_history_runs (id) on delete cascade,
  customer_id   int not null references directory_customers (id) on delete cascade,
  name          text not null,
  was_inactive  boolean not null,
  retired_at    timestamptz not null,
  undone_at     timestamptz
);
create index if not exists wo_history_retired_run_idx on wo_history_retired (run_id);

-- When an account was restored as Retired by the Work Order History import. Null for every account today. It tells
-- "Retired" apart from "Inactive in NetSuite" on the sheet and in search, and keeps the NetSuite customer import from
-- quietly setting a retired account back to Active.
alter table directory_customers add column if not exists retired_at timestamptz;
