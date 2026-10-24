-- What the tech fills in on the Equipment Request Form in KatzDesk: Done ticks and notes on the checklists, the Tech
-- notes boxes and the sign-off (install-form-entries.ts). One row per install; the rest of the form still reads from
-- the install itself. Nothing is copied here from existing data.
create table if not exists install_form_entries (
  install_id int primary key references installs(id) on delete cascade,
  entries jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by text
);
