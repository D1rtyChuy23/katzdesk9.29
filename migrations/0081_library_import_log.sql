-- One row per decision made by the Library import (duplicate marks, vendor PDFs, book MPNs).
-- apply=false does not write here. A later batch skips a vendor URL once any row for it is OK or SKIP.
create table if not exists library_import_log (
  id serial primary key,
  run_at timestamptz not null default now(),
  url text,
  book_id integer,
  action text not null check (action in ('OK', 'SKIP', 'FAIL', 'CONFLICT')),
  reason text,
  file_id integer
);

create index if not exists library_import_log_url_idx on library_import_log (url);
