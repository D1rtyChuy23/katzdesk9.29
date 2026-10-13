-- Part photos on the item list (the parts "inventory"), and MPN-keyed official files in The Library.

-- One photo per part, stored with the part. The invoice picker and the inventory list both read this same image.
alter table billing_items add column if not exists image bytea;
alter table billing_items add column if not exists image_mime text;
alter table billing_items add column if not exists image_updated_at timestamptz;

-- A Library variation (a book) can carry the manufacturer part number its official files are matched on.
-- Two variations never share an MPN. "no_official_file" is set when someone looked and the manufacturer has no
-- file for that exact MPN, so a different model's sheet is never attached in its place.
alter table library_books add column if not exists mpn text;
alter table library_books add column if not exists no_official_file boolean not null default false;
create unique index if not exists library_books_mpn_uidx
  on library_books (upper(regexp_replace(mpn, '[^A-Za-z0-9]+', '', 'g')))
  where mpn is not null and btrim(mpn) <> '';

-- A stored file is tied to an MPN only when it is the manufacturer's official file for that MPN.
-- A tied file stays on its variation: it is never copied from a main chip to the other variations.
alter table library_files add column if not exists mpn text;
alter table library_files add column if not exists source_url text;
create index if not exists library_files_mpn_idx on library_files (upper(regexp_replace(mpn, '[^A-Za-z0-9]+', '', 'g'))) where mpn is not null;
