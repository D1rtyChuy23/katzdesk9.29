-- Allow re-adding a provider after it is removed, and drop assignments with it.

drop index if exists network_providers_name_uidx;
create unique index if not exists network_providers_name_uidx
  on network_providers (lower(name))
  where archived = false;
