-- Eversys modules attach to an Eversys unit on a customer account (account_equipment row).
-- Assigned modules are not available at HQ. Warehouse returns wait on admin approval.

alter table modules add column if not exists assigned_customer text;
alter table modules add column if not exists assigned_unit_id int;
alter table modules add column if not exists assigned_unit_label text;
alter table modules add column if not exists assigned_at timestamptz;
alter table modules add column if not exists assigned_by text;
alter table modules add column if not exists return_pending boolean not null default false;
alter table modules add column if not exists return_by text;
alter table modules add column if not exists return_by_name text;
alter table modules add column if not exists return_at timestamptz;

create index if not exists modules_assigned_customer_idx on modules (lower(assigned_customer));
create index if not exists modules_assigned_unit_idx on modules (assigned_unit_id);
