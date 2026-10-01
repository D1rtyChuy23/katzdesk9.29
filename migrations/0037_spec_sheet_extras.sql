-- The Library: equipment image (taken from the spec sheet PDF at import) and counter core hole.
alter table spec_sheets add column if not exists image text;          -- data:image/jpeg;base64,... (resized, ~100 KB)
alter table spec_sheets add column if not exists core_hole text;      -- 'yes' | 'no' | null
alter table spec_sheets add column if not exists core_diameter text;  -- e.g. 3"
