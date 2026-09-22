-- Soft-remove deals/installs from their lists, and flag same-account install dupes.

alter table deals add column if not exists archived boolean not null default false;
alter table installs add column if not exists archived boolean not null default false;
alter table installs add column if not exists duplicate_of int;

create index if not exists deals_archived_idx on deals (archived);
create index if not exists installs_archived_idx on installs (archived);
