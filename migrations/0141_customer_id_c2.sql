-- Customers by id, phase C2 ("One Record Per Machine Plan", Chuy approved 11/24): account equipment, retired machines,
-- warehouse records, stock actions, rebuilds and Eversys modules get the account's id beside each name that names an
-- account. Additive: every name stays and every screen still reads it; nothing reads these ids yet. This file adds the
-- columns, the triggers and the wider relink; 0142 fills in the rows already there.
--
-- The same rule as C1 (katz_customer_id in 0138): the account with that very name, else the one account in other
-- capitals, else the one account once spaces at the ends are dropped; only accounts on the list count; anything else
-- is null. The same upkeep too: a record's trigger works the id out on insert (unless the save set one) and whenever
-- its name changes; an account added, renamed, removed, restored or deleted relinks the records under its old and new
-- name (the statement-level triggers 0138 put on directory_customers, which call katz_relink_customer_keys below).
--
-- Which columns (the names customer-identity.ts rewrites on a rename):
--   account_equipment.customer            → customer_id
--   account_equipment_retired.customer    → customer_id
--   assets.customer_owned                 → customer_owned_id         (a customer's own unit in the barn)
--   assets.sold_to                        → sold_to_id
--   assets.stock_hold_customer            → stock_hold_customer_id    (held for an account, waiting on an Admin)
--   asset_stock_actions.customer          → customer_id
--   rebuilds.account                      → account_id
--   modules.assigned_customer             → assigned_customer_id
-- modules.location is a place (it reads the account's name only while the module sits on one of its units), so it has
-- no id. A decided stock action keeps the name it was decided under, so after a rename its id follows the rule and is
-- blank until C4 sets ids directly.
--
-- None of the existing triggers on these tables fire on these columns: the equipment history trigger records only its
-- listed fields, and the serial guards fire on serial and status. So filling an id writes no history and no check.

set local lock_timeout = '15s';

-- A record's ids, for tables whose name columns aren't all called "customer", or that have several: the trigger's
-- arguments are pairs of (name column, id column). The same logic as katz_fill_customer_id in 0138, per pair.
create or replace function katz_fill_customer_ids() returns trigger language plpgsql as $$
declare
  i int := 0;
  rec_new jsonb := to_jsonb(new);
  rec_old jsonb;
  patch jsonb := '{}'::jsonb;
  name_col text;
  id_col text;
begin
  if tg_op = 'UPDATE' then rec_old := to_jsonb(old); end if;
  while i + 1 < tg_nargs loop
    name_col := tg_argv[i];
    id_col := tg_argv[i + 1];
    if tg_op = 'INSERT' then
      if rec_new -> id_col = 'null'::jsonb or not (rec_new ? id_col) then
        patch := patch || jsonb_build_object(id_col, katz_customer_id(rec_new ->> name_col));
      end if;
    -- The name changed and the statement didn't set the id itself: the id is the name's, or none.
    elsif (rec_new ->> name_col) is distinct from (rec_old ->> name_col) and (rec_new -> id_col) is not distinct from (rec_old -> id_col) then
      patch := patch || jsonb_build_object(id_col, katz_customer_id(rec_new ->> name_col));
    end if;
    i := i + 2;
  end loop;
  if patch <> '{}'::jsonb then new := jsonb_populate_record(new, patch); end if;
  return new;
end $$;

alter table account_equipment add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table account_equipment_retired add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table assets add column if not exists customer_owned_id integer references directory_customers (id) on delete set null;
alter table assets add column if not exists sold_to_id integer references directory_customers (id) on delete set null;
alter table assets add column if not exists stock_hold_customer_id integer references directory_customers (id) on delete set null;
alter table asset_stock_actions add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table rebuilds add column if not exists account_id integer references directory_customers (id) on delete set null;
alter table modules add column if not exists assigned_customer_id integer references directory_customers (id) on delete set null;

-- The records under a name, for the relink (an account added from a NetSuite file finds its rows quickly).
create index if not exists account_equipment_customer_key_idx on account_equipment (lower(btrim(customer)));
create index if not exists account_equipment_retired_customer_key_idx on account_equipment_retired (lower(btrim(customer)));
create index if not exists assets_customer_owned_key_idx on assets (lower(btrim(customer_owned))) where customer_owned is not null;
create index if not exists assets_sold_to_key_idx on assets (lower(btrim(sold_to))) where sold_to is not null;
create index if not exists assets_stock_hold_customer_key_idx on assets (lower(btrim(stock_hold_customer))) where stock_hold_customer is not null;
create index if not exists asset_stock_actions_customer_key_idx on asset_stock_actions (lower(btrim(customer))) where customer is not null;
create index if not exists rebuilds_account_key_idx on rebuilds (lower(btrim(account)));
create index if not exists modules_assigned_customer_key_idx on modules (lower(btrim(assigned_customer))) where assigned_customer is not null;

drop trigger if exists account_equipment_customer_id on account_equipment;
create trigger account_equipment_customer_id before insert or update of customer on account_equipment
  for each row execute function katz_fill_customer_ids('customer', 'customer_id');
drop trigger if exists account_equipment_retired_customer_id on account_equipment_retired;
create trigger account_equipment_retired_customer_id before insert or update of customer on account_equipment_retired
  for each row execute function katz_fill_customer_ids('customer', 'customer_id');
drop trigger if exists assets_customer_ids on assets;
create trigger assets_customer_ids before insert or update of customer_owned, sold_to, stock_hold_customer on assets
  for each row execute function katz_fill_customer_ids('customer_owned', 'customer_owned_id', 'sold_to', 'sold_to_id', 'stock_hold_customer', 'stock_hold_customer_id');
drop trigger if exists asset_stock_actions_customer_id on asset_stock_actions;
create trigger asset_stock_actions_customer_id before insert or update of customer on asset_stock_actions
  for each row execute function katz_fill_customer_ids('customer', 'customer_id');
drop trigger if exists rebuilds_account_id on rebuilds;
create trigger rebuilds_account_id before insert or update of account on rebuilds
  for each row execute function katz_fill_customer_ids('account', 'account_id');
drop trigger if exists modules_assigned_customer_id on modules;
create trigger modules_assigned_customer_id before insert or update of assigned_customer on modules
  for each row execute function katz_fill_customer_ids('assigned_customer', 'assigned_customer_id');

-- The relink now covers C1's five tables and these eight columns. Replaces 0138's version (same name and arguments, so
-- the account triggers that call it stay as they are). Each update writes only an id column, so no record trigger fires.
create or replace function katz_relink_customer_keys(keys text[]) returns void language plpgsql as $$
declare
  l record;
begin
  if keys is null or cardinality(keys) = 0 then return; end if;
  for l in
    select * from (values
      ('service_jobs', 'customer', 'customer_id'),
      ('pm_jobs', 'customer', 'customer_id'),
      ('installs', 'customer', 'customer_id'),
      ('deals', 'customer', 'customer_id'),
      ('recipes', 'customer', 'customer_id'),
      ('account_equipment', 'customer', 'customer_id'),
      ('account_equipment_retired', 'customer', 'customer_id'),
      ('assets', 'customer_owned', 'customer_owned_id'),
      ('assets', 'sold_to', 'sold_to_id'),
      ('assets', 'stock_hold_customer', 'stock_hold_customer_id'),
      ('asset_stock_actions', 'customer', 'customer_id'),
      ('rebuilds', 'account', 'account_id'),
      ('modules', 'assigned_customer', 'assigned_customer_id')
    ) v(tbl, name_col, id_col)
  loop
    execute format(
      'update %I set %I = katz_customer_id(%I)
        where lower(btrim(%I)) = any($1) and %I is distinct from katz_customer_id(%I)',
      l.tbl, l.id_col, l.name_col, l.name_col, l.id_col, l.name_col)
      using keys;
  end loop;
end $$;
