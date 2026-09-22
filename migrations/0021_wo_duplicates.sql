-- Same ST# on more than one service/TLC ticket: extras point at the original.
alter table service_jobs add column if not exists duplicate_of int;
create index if not exists service_jobs_duplicate_of_idx on service_jobs (duplicate_of);
