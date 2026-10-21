-- A PM line can be logged onto a specific account unit when the name match would not find it.
-- Additive. Nothing is deleted.

create table if not exists pm_runbook_unit_links (
  pm_job_id integer not null references pm_jobs (id) on delete cascade,
  piece_key text not null,
  account_equipment_id integer not null references account_equipment (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (pm_job_id, piece_key)
);

create index if not exists pm_runbook_unit_links_equip_idx
  on pm_runbook_unit_links (account_equipment_id);
