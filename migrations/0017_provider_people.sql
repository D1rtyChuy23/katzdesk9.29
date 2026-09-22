-- Structured people and addresses on 3rd-party providers.

create table if not exists provider_contacts (
  id          serial primary key,
  provider_id int not null references network_providers(id) on delete cascade,
  name        text,
  role        text,
  phone       text,
  email       text,
  created_at  timestamptz not null default now()
);
create index if not exists provider_contacts_provider_idx on provider_contacts (provider_id);

create table if not exists provider_addresses (
  id          serial primary key,
  provider_id int not null references network_providers(id) on delete cascade,
  label       text,
  line1       text,
  line2       text,
  city        text,
  state       text,
  zip         text,
  created_at  timestamptz not null default now()
);
create index if not exists provider_addresses_provider_idx on provider_addresses (provider_id);
