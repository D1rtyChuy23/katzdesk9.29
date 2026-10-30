-- Merge into install (Grok through Chuy, 2026-10-30). An Admin folds a service or TLC ticket into the install that
-- carries the same WO number: its charges, Ping notes, units, part lines and pings go to the install, its text goes
-- under the install's notes, and the ticket is hidden. Nothing is deleted, and each merge is logged.
--
-- A merged ticket stays in service_jobs. duplicate_of points at the ticket itself, so every list that leaves merged
-- duplicates out (duplicate_of is null) leaves it out too; merged_install_id names the install it went into.
-- Nothing existing changes: the columns start blank and the log starts empty.
alter table service_jobs add column if not exists merged_install_id int references installs (id);
alter table service_jobs add column if not exists merged_install_at timestamptz;
alter table service_jobs add column if not exists merged_install_by text;

-- A ticket is its own duplicate only when it went into an install, and one that went into an install stays hidden.
-- Not valid: the rows already there aren't re-checked at deploy (none can fail it: only a ticket merge writes
-- duplicate_of, and never the ticket's own id); every write from now on is checked.
alter table service_jobs drop constraint if exists service_jobs_merged_install_check;
alter table service_jobs add constraint service_jobs_merged_install_check check (
  (duplicate_of is distinct from id or merged_install_id is not null)
  and (merged_install_id is null or duplicate_of is not null)
) not valid;
create index if not exists service_jobs_merged_install_idx on service_jobs (merged_install_id) where merged_install_id is not null;

-- The merge checks what keeps a ticket's billing on the ticket (a NetSuite invoice, a repair quote, a stacked PM) with
-- a fresh snapshot, as pm_own_invoice_has_lines does for stacking: one added while the merge waited for its locks is
-- seen (a plain subquery in the same statement would still read the snapshot from before it).
create or replace function ticket_keeps_its_billing(job int) returns boolean language sql volatile as $$
  select exists (select 1 from ticket_invoices ti where ti.job_id = job)
      or exists (select 1 from repair_quotes q where q.job_id = job)
      or exists (select 1 from pm_jobs p where p.stacked_job_id = job)
$$;

-- One row per merge: who, when, the text added under the install's notes, and what moved, by id (the ticket's charge
-- lines and the invoice lines they became, Ping notes, pings, units, part lines, rebuilds, and tickets merged into it
-- before), so a merge can be traced or undone by hand.
create table if not exists ticket_install_merges (
  id          serial primary key,
  job_id      int not null references service_jobs (id),
  install_id  int not null references installs (id),
  merged_by   text,
  merged_at   timestamptz not null default now(),
  note        text,
  moved       jsonb not null default '{}'::jsonb
);
create unique index if not exists ticket_install_merges_job_uidx on ticket_install_merges (job_id);
create index if not exists ticket_install_merges_install_idx on ticket_install_merges (install_id);
