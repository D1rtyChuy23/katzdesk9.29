-- Extra parts logged on a PM machine, the charge line that remembers which one it came from,
-- and a PM stacked on a service or TLC ticket so the visit bills once.

create table if not exists machine_parts (
  id serial primary key,
  pm_job_id int not null references pm_jobs (id) on delete cascade,
  piece_key text not null check (length(piece_key) between 1 and 300),
  account_equipment_id int references account_equipment (id) on delete set null,
  serial_key text,
  machine_label text not null check (length(btrim(machine_label)) between 1 and 200),
  billing_item_id int references billing_items (id) on delete set null,
  item text not null check (length(btrim(item)) between 1 and 200),
  description text check (description is null or length(description) <= 500),
  qty numeric(10,2) not null default 1 check (qty > 0 and qty <= 1000),
  billable boolean not null default true,
  note text check (note is null or length(note) <= 500),
  added_by text,
  added_at timestamptz not null default now(),
  removed_by text,
  removed_at timestamptz
);
create index if not exists machine_parts_pm_idx on machine_parts (pm_job_id, piece_key, id);
create index if not exists machine_parts_serial_idx on machine_parts (serial_key, added_at desc) where serial_key is not null;
create index if not exists machine_parts_acct_idx on machine_parts (account_equipment_id, added_at desc) where account_equipment_id is not null;

alter table ticket_charges add column if not exists source_key text;
create index if not exists ticket_charges_source_key_idx on ticket_charges (source_key) where source_key is not null;

alter table pm_jobs add column if not exists stacked_job_id int references service_jobs (id) on delete set null;
create index if not exists pm_jobs_stacked_job_idx on pm_jobs (stacked_job_id) where stacked_job_id is not null;
