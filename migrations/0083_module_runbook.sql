-- One service of a module, on the bench or during a PM. Ticks belong to the service.
-- Completing it adds the checked kits to module_work. Nothing here is deleted.

create table if not exists module_runbook_services (
  id            serial primary key,
  module_id     int not null references modules (id) on delete restrict,
  context       text not null check (context in ('bench', 'pm')),
  pm_job_id     int references pm_jobs (id) on delete set null,
  runbook_id    text not null,
  interval_mo   text,
  options       jsonb not null default '{}',
  started_by    text,
  started_at    timestamptz not null default now(),
  completed_by  text,
  completed_at  timestamptz,
  check ((context = 'bench' and pm_job_id is null) or (context = 'pm' and pm_job_id is not null))
);

create unique index if not exists module_runbook_open_bench
  on module_runbook_services (module_id)
  where context = 'bench' and completed_at is null;

create unique index if not exists module_runbook_open_pm
  on module_runbook_services (module_id, pm_job_id)
  where context = 'pm' and completed_at is null;

create table if not exists module_runbook_checks (
  service_id  int not null references module_runbook_services (id) on delete cascade,
  key         text not null,
  done_by     text,
  done_at     timestamptz not null default now(),
  primary key (service_id, key)
);
