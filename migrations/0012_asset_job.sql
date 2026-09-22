-- Warehouse units pulled for a service call (loaner / swap)
alter table assets add column if not exists job_id int;
create index if not exists assets_job_idx on assets (job_id);
