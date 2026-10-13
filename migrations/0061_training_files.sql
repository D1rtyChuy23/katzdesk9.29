-- The Library: Education And Training. Training material is stored like any other Library file, but it is its
-- own section with a topic, and it never sits in a model book.
alter table library_files drop constraint if exists library_files_section_check;
alter table library_files add constraint library_files_section_check check (section in ('spec', 'manuals', 'parts', 'training'));

alter table library_files add column if not exists topic text;

-- A training file has a topic and no book. Anything else has a book (or none yet) and no topic.
-- The database refuses to file training material under a machine.
alter table library_files drop constraint if exists library_files_training_check;
alter table library_files add constraint library_files_training_check check (
  (section = 'training' and book_id is null and topic is not null)
  or (section <> 'training' and topic is null)
);

create index if not exists library_files_topic_idx on library_files (topic, lower(name)) where section = 'training';
