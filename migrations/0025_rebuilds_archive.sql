-- Soft-remove rebuild projects from the board without deleting history.
alter table rebuilds add column if not exists archived boolean not null default false;
create index if not exists rebuilds_archived_idx on rebuilds (archived);
