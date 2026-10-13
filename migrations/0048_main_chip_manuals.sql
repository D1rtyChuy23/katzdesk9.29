-- The Library: a manual on a parent's main chip (the variation named like the parent, e.g. AXIOM) is shown on
-- every variation of that parent. One stored file, no duplicates. A variation can drop its copy: that is a row
-- here, and the main file and the other variations are untouched.
create table if not exists library_file_hidden (
  file_id integer not null references library_files (id) on delete cascade,
  book_id integer not null references library_books (id) on delete cascade,
  hidden_by text,
  created_at timestamptz not null default now(),
  primary key (file_id, book_id)
);
