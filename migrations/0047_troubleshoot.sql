-- The Library: Troubleshoot. Answers come only from a variation's own manuals and parts book.
-- The text of each stored PDF is kept per page so the right pages can be found and cited.
alter table library_files add column if not exists text_pages integer;  -- null = not read yet; 0 = no readable text
create table if not exists library_file_text (
  file_id integer not null references library_files (id) on delete cascade,
  page integer not null,
  body text not null,
  primary key (file_id, page)
);
-- A fix a tech marked as working. Kept per variation; never shown on another variation.
create table if not exists library_fixes (
  id serial primary key,
  book_id integer not null references library_books (id) on delete cascade,
  issue text not null,
  cause text not null,
  checks text,
  part_number text,
  part_name text,
  fixed_by text,
  fixed_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists library_fixes_book_idx on library_fixes (book_id, created_at desc);
create table if not exists troubleshoot_log (
  user_id text not null,
  created_at timestamptz not null default now()
);
create index if not exists troubleshoot_log_user_idx on troubleshoot_log (user_id, created_at);
