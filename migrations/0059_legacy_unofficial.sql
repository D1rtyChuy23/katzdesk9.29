-- The Library: Legacy models, and unofficial sources under Troubleshoot.

-- A model its manufacturer lists as discontinued or obsolete sits under Legacy for that manufacturer.
-- It keeps its spec sheet, manuals and parts, it still opens, and it is never deleted. Moving a model there
-- needs the manufacturer source (legacy_source). confirm_legacy marks a model that could not be confirmed either
-- way: it stays in the main row until someone confirms it.
alter table library_books add column if not exists legacy boolean not null default false;
alter table library_books add column if not exists legacy_source text;
alter table library_books add column if not exists legacy_note text;
alter table library_books add column if not exists legacy_by text;
alter table library_books add column if not exists legacy_at timestamptz;
alter table library_books add column if not exists confirm_legacy boolean not null default false;

-- Links and notes from the field on one variation. Labeled unofficial wherever they show.
-- Troubleshoot never reads this table: its steps come only from the files stored on the variation.
create table if not exists library_unofficial_sources (
  id serial primary key,
  book_id integer not null references library_books (id) on delete cascade,
  url text,
  note text,
  added_by text,
  added_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists library_unofficial_sources_book_idx on library_unofficial_sources (book_id, created_at desc);
