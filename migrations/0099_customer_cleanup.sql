-- Customers cleanup (Chuy, 2026-10-26). Remove now records who took an account off the Customers list and when, so
-- Customers can list what was removed and bring it back (Restore); a merged account is never marked this way. On
-- Possible Duplicates, Not a Duplicate keeps a pair that was checked from showing again. Nothing existing changes:
-- both columns start blank and the new table starts empty.
alter table directory_customers add column if not exists removed_at timestamptz;
alter table directory_customers add column if not exists removed_by text;

create table if not exists customer_dupe_dismissals (
  low_id int not null references directory_customers(id) on delete cascade,
  high_id int not null references directory_customers(id) on delete cascade,
  dismissed_by text,
  dismissed_at timestamptz not null default now(),
  primary key (low_id, high_id),
  check (low_id < high_id)
);
