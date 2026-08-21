-- Warehouse assets + recipes (team-wide)

create table if not exists assets (
  id              serial primary key,
  kind            text not null check (kind in ('equip', 'dispenser', 'module')),
  model           text not null,
  serial          text,
  qty             int not null default 1,
  customer_owned  text,
  site            text not null,
  pallet          text,
  level           int,
  line_no         int,
  purpose         text,
  status          text not null default 'ready',
  sold_to         text,
  sold_at         date,
  install_id      int,
  notes           text,
  updated_at      timestamptz not null default now()
);
create index if not exists assets_site_status_idx on assets (site, status);
create index if not exists assets_model_idx on assets (model);
create index if not exists assets_install_idx on assets (install_id);
create index if not exists assets_slot_idx on assets (site, pallet, level, line_no);

create table if not exists recipes (
  id               serial primary key,
  equipment_model  text not null unique,
  coffee_1         text,
  coffee_2         text,
  coffee_3         text,
  powder_1         text,
  powder_2         text,
  powder_3         text,
  americano_1      text,
  americano_2      text,
  americano_3      text,
  milk             text,
  notes            text,
  updated_at       timestamptz not null default now()
);
