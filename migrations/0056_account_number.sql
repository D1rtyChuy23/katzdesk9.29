-- Account Number on a customer. Text, so leading zeros and dashes are kept as typed.
alter table directory_customers add column if not exists account_number text;
-- Unique when filled in (ignoring case and outside spaces); blank is allowed on any number of accounts.
-- Removed (archived) accounts do not hold a number.
create unique index if not exists directory_customers_account_number_uidx
  on directory_customers (lower(btrim(account_number)))
  where account_number is not null and btrim(account_number) <> '' and archived = false;
