-- In-house rebuilds: shop projects, not field tickets.

create table if not exists rebuilds (
  id serial primary key,
  title text not null,
  account text not null,
  equipment text,
  serial text,
  asset_id int,
  owner text,
  status text not null default 'Queued',
  reason_code text,
  reason_detail text,
  planned_start date,
  target_complete date,
  actual_start date,
  actual_complete date,
  priority text not null default 'normal',
  notes text,
  install_id int,
  job_id int,
  serial_notice text,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rebuilds_status_idx on rebuilds (status);
create index if not exists rebuilds_owner_idx on rebuilds (owner);
create index if not exists rebuilds_account_idx on rebuilds (lower(account));
create index if not exists rebuilds_target_idx on rebuilds (target_complete);
