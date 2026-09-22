-- Structured coverage: multiple states, cities, and ZIP codes per provider.

create table if not exists provider_locations (
  id          serial primary key,
  provider_id int not null references network_providers(id) on delete cascade,
  state       text not null,
  city        text,
  zip         text,
  created_at  timestamptz not null default now()
);

create unique index if not exists provider_locations_uniq
  on provider_locations (
    provider_id,
    state,
    coalesce(lower(city), ''),
    coalesce(zip, '')
  );

create index if not exists provider_locations_provider_idx
  on provider_locations (provider_id, state);
