-- Katz Desk shared operations tables (team-wide, not per-user)

create table if not exists service_jobs (
  id            serial primary key,
  kind          text not null check (kind in ('service', 'tlc')),
  call_id       text not null,
  contact       text,
  phone         text,
  received      date,
  customer      text,
  equipment     text,
  issue         text,
  call_type     text,
  phone_resolved boolean not null default false,
  status        text not null default 'Open',
  technician    text,
  wo            text,
  scheduled     date,
  notes         text,
  done          boolean not null default false,
  updated_at    timestamptz not null default now(),
  unique (kind, call_id)
);
create index if not exists service_jobs_status_idx on service_jobs (kind, status);
create index if not exists service_jobs_customer_idx on service_jobs (customer);

create table if not exists pm_jobs (
  id            serial primary key,
  customer      text not null,
  received      date,
  equipment     text,
  style         text,
  projected     date,
  parts_status  text,
  status        text not null default 'Pending Scheduling',
  technician    text,
  notes         text,
  done          boolean not null default false,
  updated_at    timestamptz not null default now()
);
create index if not exists pm_jobs_status_idx on pm_jobs (status);

create table if not exists modules (
  id            serial primary key,
  module_id     text not null unique,
  platform      text,
  module_type   text,
  status        text not null default 'Not Started',
  wo            text,
  location      text,
  date_in       date,
  date_ready    date,
  technician    text,
  notes         text,
  updated_at    timestamptz not null default now()
);

create table if not exists deals (
  id            serial primary key,
  customer      text not null,
  producer      text,
  account_type  text,
  date_of_deal  date,
  equipment     text,
  amount        numeric(12,2),
  good_to_order boolean not null default false,
  ordered       boolean not null default false,
  eta           text,
  terms         text,
  invoice       text,
  completion    text,
  notes         text,
  updated_at    timestamptz not null default now()
);

create table if not exists installs (
  id             serial primary key,
  received       date,
  customer       text not null,
  equipment      text,
  equip_status   text,
  install_date   date,
  technician     text,
  wo             text,
  reqs_ready     text,
  notes          text,
  account_rep    text,
  payment_status text,
  complete       boolean not null default false,
  deal_id        int,
  updated_at     timestamptz not null default now()
);
create index if not exists installs_status_idx on installs (equip_status);

create table if not exists comments (
  id            serial primary key,
  entity_type   text not null,
  entity_id     int not null,
  author_id     text,
  author_name   text,
  body          text not null,
  ask_team      text,
  resolved      boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists comments_entity_idx on comments (entity_type, entity_id, created_at);

create table if not exists activity (
  id            serial primary key,
  entity_type   text not null,
  entity_id     int not null,
  actor_name    text,
  action        text not null,
  detail        text,
  created_at    timestamptz not null default now()
);
create index if not exists activity_entity_idx on activity (entity_type, entity_id, created_at);

create table if not exists seed_meta (
  k text primary key,
  v text not null
);
