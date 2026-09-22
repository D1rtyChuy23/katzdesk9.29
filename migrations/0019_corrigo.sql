-- Corrigo service import: description of work + date completed on tickets.
alter table service_jobs add column if not exists work_done text;
alter table service_jobs add column if not exists completed_at date;
create index if not exists service_jobs_wo_idx on service_jobs (wo);
