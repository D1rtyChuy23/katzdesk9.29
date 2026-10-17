-- Library import log. One row per decision (stored, skipped, failed, or a conflict).
-- Applied on deploy by scripts/migrate.mjs. Nothing here reads or changes existing Library files.
create table if not exists library_import_log (
  id serial primary key,
  run_at timestamptz not null default now(),
  url text,
  book_id integer,
  action text not null check (action in ('OK', 'SKIP', 'FAIL', 'CONFLICT')),
  reason text,
  file_id integer
);
create index if not exists library_import_log_url_idx on library_import_log (url, book_id, id);
