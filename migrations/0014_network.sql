-- Out-of-network 3rd-party service providers + customer assignments.

create table if not exists network_providers (
  id                 serial primary key,
  name               text not null,
  status             text,
  dispatch_phone     text,
  dispatch_email     text,
  secondary_phone    text,
  secondary_email    text,
  response_time      text,
  standard_rate      text,
  after_hours_rate   text,
  travel_policy      text,
  equipment_serviced text,
  coverage           text,
  contacts           text,
  pm_pricing         text,
  parts_stocking     text,
  notes              text,
  last_updated       date,
  archived           boolean not null default false,
  updated_at         timestamptz not null default now()
);
create unique index if not exists network_providers_name_uidx
  on network_providers (lower(name));
create index if not exists network_providers_status_idx on network_providers (status);

create table if not exists network_accounts (
  id          serial primary key,
  customer    text not null,
  email       text,
  contact     text,
  phone       text,
  address     text,
  city        text,
  state       text,
  zip         text,
  equipment   text,
  ownership   text,
  region      text,
  updated_at  timestamptz not null default now()
);
create unique index if not exists network_accounts_customer_uidx
  on network_accounts (lower(customer));
create index if not exists network_accounts_state_idx on network_accounts (state);

create table if not exists customer_providers (
  id          serial primary key,
  customer    text not null,
  provider_id int not null references network_providers(id),
  role        text not null default 'additional'
                check (role in ('primary', 'secondary', 'additional')),
  updated_at  timestamptz not null default now()
);
create unique index if not exists customer_providers_pair_uidx
  on customer_providers (provider_id, lower(customer));
create index if not exists customer_providers_customer_idx
  on customer_providers (lower(customer));
create index if not exists customer_providers_role_idx
  on customer_providers (provider_id, role);
