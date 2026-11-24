-- Customers by id, phase C1 ("One Record Per Machine Plan", Chuy approved 11/24): tickets, PMs, installs, deals and
-- recipes get the account's id beside the name. Additive: the name stays and every screen still reads it; nothing reads
-- customer_id yet. Rows only gain a value in a new column; no name, date or other column changes.
--
-- Which account a name means (choice 1: a name that finds no account, or several, is left unlinked and listed on Link
-- Check, never guessed). Only accounts on the list (not archived) count:
--   1. the account with that very name;
--   2. else the one account by name in other capitals (lower(x) = lower(name));
--   3. else the one account once spaces at the ends are dropped (lower(btrim(...))).
-- Anything else is null.
--
-- Keeping it filled while every save still writes names (until phase C6): a trigger fills customer_id on insert unless
-- the statement set one, and when the name changes. On a name change that finds no account it keeps the id it had:
-- a rename rewrites these names before it renames the account, so for that moment the new name finds nothing. A save
-- can't put an unlisted name on these records (the app checks the list), so that case is the rename. Merge moves the
-- dropped account's ids to the kept one itself (src/lib/ops/customer-identity.ts).

create index if not exists directory_customers_lower_name_idx on directory_customers (lower(name)) where archived = false;
create index if not exists directory_customers_lower_btrim_name_idx on directory_customers (lower(btrim(name))) where archived = false;

create or replace function katz_customer_id(raw text) returns integer language sql stable as $$
  select coalesce(
    (select min(id) from directory_customers where archived = false and name = raw),
    (select min(id) from directory_customers where archived = false and lower(name) = lower(raw) having count(*) = 1),
    (select min(id) from directory_customers where archived = false and lower(btrim(name)) = lower(btrim(raw)) having count(*) = 1)
  )
  where coalesce(btrim(raw), '') <> ''
$$;

create or replace function katz_fill_customer_id() returns trigger language plpgsql as $$
declare
  found integer;
begin
  if tg_op = 'INSERT' then
    if new.customer_id is null then new.customer_id := katz_customer_id(new.customer); end if;
    return new;
  end if;
  -- The name changed and the statement didn't set the id itself.
  if new.customer is distinct from old.customer and new.customer_id is not distinct from old.customer_id then
    found := katz_customer_id(new.customer);
    if found is not null then new.customer_id := found; end if;
  end if;
  return new;
end $$;

alter table service_jobs add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table pm_jobs add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table installs add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table deals add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table recipes add column if not exists customer_id integer references directory_customers (id) on delete set null;

create index if not exists service_jobs_customer_id_idx on service_jobs (customer_id);
create index if not exists pm_jobs_customer_id_idx on pm_jobs (customer_id);
create index if not exists installs_customer_id_idx on installs (customer_id);
create index if not exists deals_customer_id_idx on deals (customer_id);
create index if not exists recipes_customer_id_idx on recipes (customer_id);

-- Backfill: once, for rows without an id. Fires no trigger (the name isn't set).
update service_jobs set customer_id = katz_customer_id(customer) where customer_id is null;
update pm_jobs set customer_id = katz_customer_id(customer) where customer_id is null;
update installs set customer_id = katz_customer_id(customer) where customer_id is null;
update deals set customer_id = katz_customer_id(customer) where customer_id is null;
update recipes set customer_id = katz_customer_id(customer) where customer_id is null;

drop trigger if exists service_jobs_customer_id on service_jobs;
create trigger service_jobs_customer_id before insert or update of customer on service_jobs for each row execute function katz_fill_customer_id();
drop trigger if exists pm_jobs_customer_id on pm_jobs;
create trigger pm_jobs_customer_id before insert or update of customer on pm_jobs for each row execute function katz_fill_customer_id();
drop trigger if exists installs_customer_id on installs;
create trigger installs_customer_id before insert or update of customer on installs for each row execute function katz_fill_customer_id();
drop trigger if exists deals_customer_id on deals;
create trigger deals_customer_id before insert or update of customer on deals for each row execute function katz_fill_customer_id();
drop trigger if exists recipes_customer_id on recipes;
create trigger recipes_customer_id before insert or update of customer on recipes for each row execute function katz_fill_customer_id();
