-- The sign-in screen's public lookups (is this username free, which email signs this username in, is this person
-- invited) are counted per address, so nobody can run through usernames to collect staff emails (11/16). Holds a
-- hash of the address and the time; rows older than a day are cleared as it is used. Adds a table only.
create table if not exists sign_in_lookups (
  id bigserial primary key,
  ip_hash text not null,
  at timestamptz not null default now()
);
create index if not exists sign_in_lookups_ip_at_idx on sign_in_lookups (ip_hash, at);
