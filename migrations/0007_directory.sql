-- Master customer + equipment lists (add / archive; jobs keep historical names)

create table if not exists directory_customers (
  id         serial primary key,
  name       text not null,
  archived   boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index if not exists directory_customers_name_uidx
  on directory_customers (name);

create table if not exists directory_equipment (
  id         serial primary key,
  name       text not null,
  archived   boolean not null default false,
  updated_at timestamptz not null default now()
);
create unique index if not exists directory_equipment_name_uidx
  on directory_equipment (name);
