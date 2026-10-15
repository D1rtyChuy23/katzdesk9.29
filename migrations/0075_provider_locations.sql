-- Map pins for Out of Network service providers, a website on each provider, and a record of which provider a
-- duplicate was merged into (Out Of Network → Import Providers). Nothing is removed: a merged duplicate is archived
-- and points at the provider it was merged into.

-- Where the provider's address sits on the map, from the US Census geocoder (same meaning as on customers).
alter table provider_addresses add column if not exists latitude double precision;
alter table provider_addresses add column if not exists longitude double precision;
alter table provider_addresses add column if not exists geocode_match text;
alter table provider_addresses add column if not exists geocode_address text;
alter table provider_addresses add column if not exists geocoded_at timestamptz;

comment on column provider_addresses.latitude is
  'Map pin latitude for this address, from the US Census geocoder. Empty when the address has not been placed on the map.';
comment on column provider_addresses.longitude is
  'Map pin longitude for this address, from the US Census geocoder. Empty when the address has not been placed on the map.';
comment on column provider_addresses.geocode_match is
  'How good the pin is: exact (the street address was found), close (the geocoder''s near match, check the building) or approx (only the ZIP code''s center was found, never used for directions).';
comment on column provider_addresses.geocode_address is
  'The address the geocoder matched, as it returned it (for example "1407 TULIP LN, ODESSA, TX, 79761").';
comment on column provider_addresses.geocoded_at is
  'When the pin was last saved by a provider import.';

-- The provider's web site.
alter table network_providers add column if not exists website text;
comment on column network_providers.website is
  'The provider''s web site address, as found online (for example "https://www.example.com").';

-- A duplicate merged into another provider: archived, and pointing at the provider that kept its accounts.
alter table network_providers add column if not exists merged_into int references network_providers(id);
comment on column network_providers.merged_into is
  'Set when this provider was a duplicate and was merged into another provider: the id of the provider that took its customers, contacts, addresses and coverage. A merged provider is archived, never deleted.';

create index if not exists network_providers_merged_into_idx on network_providers (merged_into) where merged_into is not null;
