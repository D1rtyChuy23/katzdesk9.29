-- Repair Quote: parts and labor quoted on a service ticket or a rebuild project.
-- One quote can belong to a ticket, a rebuild, or both: a rebuild linked to a ticket uses that ticket's quote,
-- so the cost sits on the project and there is never a second sheet for the same job.
create table if not exists repair_quotes (
  id          serial primary key,
  -- "set null", not cascade: merging two tickets must not take a rebuild's cost with it.
  job_id      integer references service_jobs (id) on delete set null,
  rebuild_id  integer references rebuilds (id) on delete set null,
  status      text not null default 'Draft' check (status in ('Draft', 'Sent', 'Approved', 'Declined')),
  note        text,
  updated_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists repair_quotes_job_key on repair_quotes (job_id) where job_id is not null;
create unique index if not exists repair_quotes_rebuild_key on repair_quotes (rebuild_id) where rebuild_id is not null;

create table if not exists repair_quote_lines (
  id          serial primary key,
  quote_id    integer not null references repair_quotes (id) on delete cascade,
  item        text not null,
  description text,
  qty         numeric(10, 2) not null default 1 check (qty > 0),
  rate        numeric(12, 2) not null default 0 check (rate >= 0),
  kind        text not null default 'part' check (kind in ('trip', 'labor', 'part', 'equipment', 'other')),
  sort        integer not null default 0
);
create index if not exists repair_quote_lines_quote_idx on repair_quote_lines (quote_id, sort, id);
