-- Customers by id, phase C1 ("One Record Per Machine Plan", Chuy approved 11/24): tickets, PMs, installs, deals and
-- recipes get the account's id beside the name. Additive: the name stays and every screen still reads it; nothing reads
-- customer_id yet. This file adds the columns, the rule and the triggers; 0139 fills in the rows already there.
--
-- Which account a name means (choice 1: a name that finds no account, or several, is left unlinked and listed on Link
-- Check, never guessed). Only accounts on the list (not archived) count:
--   1. the account with that very name;
--   2. else the one account by name in other capitals (lower(x) = lower(name));
--   3. else the one account once spaces at the ends are dropped (lower(btrim(...))).
-- Anything else is null.
--
-- The id always follows the rule, while every save still writes names (until phase C6):
--   - a record's trigger works it out on insert (unless the save set one) and whenever its name changes, null when the
--     name finds no account;
--   - an account's trigger works it out again for the records under its old and new name whenever an account is added,
--     renamed, removed or restored. A rename rewrites the records' names first and the account's last, so for that
--     moment the records are unlinked; the account's rename links them again.

set local lock_timeout = '15s';

create index if not exists directory_customers_lower_name_idx on directory_customers (lower(name)) where archived = false;
create index if not exists directory_customers_lower_btrim_name_idx on directory_customers (lower(btrim(name))) where archived = false;

create or replace function katz_customer_id(raw text) returns integer language sql stable as $$
  select coalesce(
    -- lower() first so the lower(name) index serves step 1 too.
    (select min(id) from directory_customers where archived = false and lower(name) = lower(raw) and name = raw),
    (select min(id) from directory_customers where archived = false and lower(name) = lower(raw) having count(*) = 1),
    (select min(id) from directory_customers where archived = false and lower(btrim(name)) = lower(btrim(raw)) having count(*) = 1)
  )
  where coalesce(btrim(raw), '') <> ''
$$;

create or replace function katz_fill_customer_id() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.customer_id is null then new.customer_id := katz_customer_id(new.customer); end if;
    return new;
  end if;
  -- The name changed and the statement didn't set the id itself: the id is the name's, or none.
  if new.customer is distinct from old.customer and new.customer_id is not distinct from old.customer_id then
    new.customer_id := katz_customer_id(new.customer);
  end if;
  return new;
end $$;

alter table service_jobs add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table pm_jobs add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table installs add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table deals add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table recipes add column if not exists customer_id integer references directory_customers (id) on delete set null;

-- The records under a name, for the account trigger (an account added from a NetSuite file finds its rows quickly).
create index if not exists service_jobs_customer_key_idx on service_jobs (lower(btrim(customer)));
create index if not exists pm_jobs_customer_key_idx on pm_jobs (lower(btrim(customer)));
create index if not exists installs_customer_key_idx on installs (lower(btrim(customer)));
create index if not exists deals_customer_key_idx on deals (lower(btrim(customer)));
create index if not exists recipes_customer_key_idx on recipes (lower(btrim(customer)));

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

-- An account added, renamed, removed or restored: the records under its old and new name follow the rule again.
create or replace function katz_relink_customer_names() returns trigger language plpgsql as $$
declare
  keys text[] := array[lower(btrim(coalesce(new.name, '')))];
  t text;
begin
  if tg_op = 'UPDATE' then keys := keys || lower(btrim(coalesce(old.name, ''))); end if;
  foreach t in array array['service_jobs', 'pm_jobs', 'installs', 'deals', 'recipes'] loop
    execute format(
      'update %I set customer_id = katz_customer_id(customer)
        where lower(btrim(customer)) = any($1) and customer_id is distinct from katz_customer_id(customer)', t)
      using keys;
  end loop;
  return null;
end $$;

drop trigger if exists directory_customers_relink_insert on directory_customers;
create trigger directory_customers_relink_insert after insert on directory_customers
  for each row execute function katz_relink_customer_names();
drop trigger if exists directory_customers_relink_update on directory_customers;
create trigger directory_customers_relink_update after update of name, archived on directory_customers
  for each row when (old.name is distinct from new.name or old.archived is distinct from new.archived)
  execute function katz_relink_customer_names();
