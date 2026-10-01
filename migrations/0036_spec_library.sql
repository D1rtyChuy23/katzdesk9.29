-- The Library: manufacturer spec sheets saved as structured data (the PDF itself is never kept).

create table if not exists spec_sheets (
  id            serial primary key,
  manufacturer  text not null,
  model         text not null,
  category      text,
  summary       text,
  specs         jsonb not null default '[]'::jsonb,   -- [{label, value}]
  mfr_notes     jsonb not null default '{}'::jsonb,   -- {usContact, warranty, certifications[]}
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint spec_sheets_mfr_model_key unique (manufacturer, model)
);
create index if not exists spec_sheets_lower_idx on spec_sheets (lower(manufacturer), lower(model));

create table if not exists spec_configs (
  id            serial primary key,
  sheet_id      int not null references spec_sheets (id) on delete cascade,
  label         text not null,
  position      int not null default 0,
  requirements  jsonb not null default '{}'::jsonb   -- {power, water, drain, dimensions, other}
);
create index if not exists spec_configs_sheet_idx on spec_configs (sheet_id, position);

-- One row per AI extraction, for the per-user hourly limit (each import spends the owner's xAI credits).
create table if not exists spec_import_log (
  id          serial primary key,
  user_id     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists spec_import_log_user_idx on spec_import_log (user_id, created_at);
