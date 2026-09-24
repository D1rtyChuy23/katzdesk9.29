-- One site pre-inspection per install. Photos stay on the inspection, not loose account files.

create table if not exists install_inspections (
  install_id       int primary key references installs(id) on delete cascade,
  inspector        text,
  inspected_on     date,
  site_contact     text,
  notes            text,
  override_reason  text,
  override_by      text,
  updated_at       timestamptz not null default now()
);

create table if not exists install_inspection_items (
  id           serial primary key,
  install_id   int not null references installs(id) on delete cascade,
  category     text not null,
  status       text not null default 'Not inspected',
  notes        text,
  updated_at   timestamptz not null default now(),
  unique (install_id, category)
);

create table if not exists install_inspection_photos (
  id           serial primary key,
  install_id   int not null references installs(id) on delete cascade,
  category     text not null,
  caption      text,
  mime         text not null default 'image/jpeg',
  data_url     text not null,
  uploaded_by  text,
  uploaded_at  timestamptz not null default now()
);

create index if not exists install_inspection_photos_cat_idx
  on install_inspection_photos (install_id, category);
