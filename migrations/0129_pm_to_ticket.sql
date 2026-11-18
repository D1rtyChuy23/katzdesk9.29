-- A PM filed by mistake becomes a service ticket (Chuy, 11/18: WO-1107, a Mazzer hopper repair filed as PM #171).
-- Nothing is deleted. The PM stays as a closed record pointing at its ticket; the ticket points back; the log keeps
-- the PM exactly as it was, so "Move back to PM" can put it back. New columns start empty; no row is changed here.
alter table pm_jobs add column if not exists moved_job_id int references service_jobs (id) on delete set null;
alter table service_jobs add column if not exists moved_from_pm_id int references pm_jobs (id) on delete set null;
create index if not exists pm_jobs_moved_job_idx on pm_jobs (moved_job_id) where moved_job_id is not null;
create index if not exists service_jobs_moved_from_pm_idx on service_jobs (moved_from_pm_id) where moved_from_pm_id is not null;

create table if not exists pm_ticket_moves (
  id              serial primary key,
  pm_id           int not null references pm_jobs (id),
  job_id          int not null references service_jobs (id),
  moved_at        timestamptz not null default now(),
  moved_by        text,
  -- The PM row as it was before the move.
  pm_before       jsonb not null,
  undone_at       timestamptz,
  undone_by       text,
  -- The ticket row as it was when it was moved back.
  job_before_undo jsonb
);
create index if not exists pm_ticket_moves_pm_idx on pm_ticket_moves (pm_id);
create index if not exists pm_ticket_moves_job_idx on pm_ticket_moves (job_id);
