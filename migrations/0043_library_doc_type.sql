-- The Library: a manual is named by its type (Cleaning Manual, Programming Manual …), not a generic "Manual".
-- Null for files stored before this and for spec sheets.
alter table library_files add column if not exists doc_type text;
