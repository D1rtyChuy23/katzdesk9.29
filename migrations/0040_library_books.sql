-- The Library: one book per equipment family. Every file and spec sheet sits in a book.
create table if not exists library_books (
  id serial primary key,
  title text not null,
  created_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists library_books_title_key on library_books (lower(title));

alter table library_files add column if not exists book_id integer references library_books (id) on delete set null;
alter table library_files add column if not exists original_name text;
-- Spec sheet originals are stored too, so they can be opened and sent like manuals.
alter table library_files drop constraint if exists library_files_section_check;
alter table library_files add constraint library_files_section_check check (section in ('spec', 'manuals', 'parts'));
create index if not exists library_files_book_idx on library_files (book_id);

alter table spec_sheets add column if not exists book_id integer references library_books (id) on delete set null;
