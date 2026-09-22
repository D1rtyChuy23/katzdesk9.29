-- WO + description of work on PMs and installs so Corrigo can update those boards.
alter table pm_jobs add column if not exists wo text;
alter table pm_jobs add column if not exists work_done text;
alter table pm_jobs add column if not exists completed_at date;
create index if not exists pm_jobs_wo_idx on pm_jobs (wo);

alter table installs add column if not exists work_done text;
alter table installs add column if not exists completed_at date;
