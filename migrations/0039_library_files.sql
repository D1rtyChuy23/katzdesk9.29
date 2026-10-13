-- The Library: Manuals and Parts Diagrams. The file itself lives in Postgres (no persistent disk on deploy).
-- Stored as bytea in ~1 MB pieces so uploads and downloads stay under the host's request size limit.
create table if not exists library_files (
  id serial primary key,
  section text not null check (section in ('manuals', 'parts')),
  name text not null,
  mime text not null,
  size integer not null,
  token text not null unique,
  added_by text,
  added_by_name text,
  complete boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists library_files_section_idx on library_files (section, lower(name));

create table if not exists library_file_chunks (
  file_id integer not null references library_files (id) on delete cascade,
  seq integer not null,
  data bytea not null,
  primary key (file_id, seq)
);
