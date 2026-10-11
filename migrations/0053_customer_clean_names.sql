-- Clean customer list (NetSuite): names applied from the list are locked until unlocked on the review.
alter table directory_customers add column if not exists name_locked boolean not null default false;
alter table directory_customers add column if not exists locked_at timestamptz;
alter table directory_customers add column if not exists locked_by text;
alter table directory_customers add column if not exists netsuite_id text;
-- Flagged for removal on the review. Nothing is deleted until that is confirmed.
alter table directory_customers add column if not exists removal_flag boolean not null default false;

create table if not exists customer_clean_runs (
  id          serial primary key,
  filename    text,
  created_by  text,
  created_at  timestamptz not null default now(),
  row_count   int not null default 0
);

-- One line per account on the report: exact | similar | no_match | walk_in | cimbali.
-- status: pending | apply (exact, waiting to be applied) | locked | kept | skipped | removal | unlocked
create table if not exists customer_clean_items (
  id           serial primary key,
  run_id       int not null references customer_clean_runs(id) on delete cascade,
  kind         text not null,
  customer_id  int,
  katz_name    text,
  clean_name   text,
  netsuite_id  text,
  reason       text,
  status       text not null default 'pending',
  note         text,
  decided_by   text,
  decided_at   timestamptz
);
create index if not exists customer_clean_items_run_idx on customer_clean_items (run_id);
