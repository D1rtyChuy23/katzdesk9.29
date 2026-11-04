-- Photos on installs, service and TLC tickets, and PMs (Chuy, 11/4). An install's photos also show on its account's
-- Photos tab; a ticket's or a PM's stay on that ticket. Each photo is on exactly one record. Like the pre-inspection
-- photos and the Library, the bytes live in Postgres: the browser shrinks a photo to about 2,000 px and under 0.5 MB
-- before it's sent (so one request carries it), plus a small preview for the grids.
-- A photo's name isn't stored: it's made when it's shown or downloaded, from the record's customer and work order and
-- the photo's place on it ("Customer - install - WO-1234 (2)"), so a rename or a merge names it the new way.
create table if not exists ticket_photos (
  id serial primary key,
  install_id int references installs (id) on delete cascade,
  job_id int references service_jobs (id) on delete cascade,
  pm_id int references pm_jobs (id) on delete cascade,
  mime text not null default 'image/jpeg',
  data bytea not null,
  thumb bytea not null,
  bytes int not null,
  width int not null,
  height int not null,
  added_by text not null,
  added_by_name text,
  added_at timestamptz not null default now(),
  check (num_nonnulls(install_id, job_id, pm_id) = 1)
);
create index if not exists ticket_photos_install_idx on ticket_photos (install_id, added_at, id) where install_id is not null;
create index if not exists ticket_photos_job_idx on ticket_photos (job_id, added_at, id) where job_id is not null;
create index if not exists ticket_photos_pm_idx on ticket_photos (pm_id, added_at, id) where pm_id is not null;
