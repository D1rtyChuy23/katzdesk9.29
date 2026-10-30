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

-- QuickBooks history on the ticket, or on a ticket merged into it before (a ticket merge moves the charges to the ticket
-- kept and leaves the history where it was): its charges may be billed already. Read fresh, the same way.
create or replace function ticket_has_quickbooks_history(job int) returns boolean language sql volatile as $$
  select exists (
    select 1 from wo_history h
     where h.job_id = job
        or h.job_id in (select s.id from service_jobs s where s.duplicate_of = job and s.id <> job)
  )
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
create index if not exists ticket_install_merges_job_idx on ticket_install_merges (job_id);
create index if not exists ticket_install_merges_install_idx on ticket_install_merges (install_id);

-- The installs merged into one (or flagged as its possible duplicates), for the notes rule below to find them.
create index if not exists installs_duplicate_of_idx on installs (duplicate_of) where duplicate_of is not null;

-- Notes compared as text: line breaks as \n, blanks at either end left out, nothing as ''.
create or replace function notes_plain(t text) returns text language sql immutable as $$
  select btrim(replace(replace(coalesce(t, ''), E'\r\n', E'\n'), E'\r', E'\n'), E' \t\n')
$$;

-- An install window's save of its notes, worked out on the row it writes. A window opened before a ticket was merged into
-- the install doesn't show the text the merge added under the notes, and its save must not drop it. base is the notes the
-- window's text was typed on: as it opened them, then as its last save that went through sent them.
-- The window didn't change the notes since its base: they stay as stored. It did: its text, as before (the last save
-- wins), then each text a ticket merge added that the window never had: in the notes now, but neither in its base nor in
-- what it sends. That counts tickets merged into installs merged into this one since (their notes came along). Read
-- fresh (volatile), so a merge that committed while this save waited for the row counts.
create or replace function notes_after_window_save(install int, stored text, base text, sent text) returns text language sql volatile as $$
  with recursive family (id, depth) as (
    select install, 0
    union all
    select i.id, f.depth + 1 from installs i join family f on i.duplicate_of = f.id where i.archived and f.depth < 20
  ), v as (
    select notes_plain(stored) as s,
           notes_plain(base) as b,
           notes_plain(sent) as t,
           rtrim(replace(replace(coalesce(sent, ''), E'\r\n', E'\n'), E'\r', E'\n'), E' \t\n') as own
  ), kept as (
    select string_agg(m.note, E'\n\n' order by m.merged_at, m.id) as added
      from v, (select id, merged_at, notes_plain(note) as note from ticket_install_merges where install_id in (select id from family)) m
     where m.note <> '' and strpos(v.s, m.note) > 0 and strpos(v.b, m.note) = 0 and strpos(v.t, m.note) = 0
  )
  select case
           when v.t = v.b then stored
           when kept.added is null then sent
           when v.own = '' then kept.added
           else v.own || E'\n\n' || kept.added
         end
    from v, kept
$$;
