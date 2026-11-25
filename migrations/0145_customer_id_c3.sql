-- Customers by id, phase C3 ("One Record Per Machine Plan", Chuy approved 11/24): work order history, the network
-- tables, invoices, module stops and move requests get the account's id beside each name that names an account.
-- Additive: every name stays and every screen still reads it; nothing reads these ids yet. This file adds the columns,
-- the triggers and the wider relink; 0146 fills in the rows already there.
--
-- Which columns, and how each keeps its id:
--   Follows the account (the rename rewrites these names, so the id follows the rule as in C1 and C2):
--     wo_history.customer                       → customer_id
--     network_accounts.customer                 → customer_id
--     customer_providers.customer               → customer_id
--   Kept (history: the name stays as it was, choice 2, so the id is kept with it):
--     invoices.customer                         → customer_id   (bill_account is the account number, not a name)
--     module_stops.customer                     → customer_id
--     equipment_move_requests.from_customer     → from_customer_id
--     equipment_move_requests.to_customer       → to_customer_id
--     asset_stock_actions.customer (C2)         → customer_id   (now kept too: a decided one keeps the name it was
--                                                                decided under)
--
-- A kept id is set the same way (0138's rule, when the row is saved, and again whenever the row's own name changes),
-- and any account event (added, renamed, removed, restored) fills the rows under its old and new name that have none,
-- by the rule at that moment. An account event never clears or changes one: the row still belongs to that account, as
-- the name it shows says it did. Two ways it does change:
--   - the row's own name is saved again as another name (an invoice approved again after its ticket moved): the id is
--     that name's, or none when it finds no listed account;
--   - a hard delete of the account (the foreign key) clears it.
-- C4 moves a merged account's rows by id, and takes an invoice's account from its ticket, PM or install.

set local lock_timeout = '15s';

alter table wo_history add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table network_accounts add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table customer_providers add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table invoices add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table module_stops add column if not exists customer_id integer references directory_customers (id) on delete set null;
alter table equipment_move_requests add column if not exists from_customer_id integer references directory_customers (id) on delete set null;
alter table equipment_move_requests add column if not exists to_customer_id integer references directory_customers (id) on delete set null;

-- The records under a name, for the relink.
-- (wo_history already has this one: wo_history_customer_idx, from 0100.)
create index if not exists network_accounts_customer_key_idx on network_accounts (lower(btrim(customer)));
create index if not exists customer_providers_customer_key_idx on customer_providers (lower(btrim(customer)));
create index if not exists invoices_customer_key_idx on invoices (lower(btrim(customer))) where customer is not null;
create index if not exists module_stops_customer_key_idx on module_stops (lower(btrim(customer))) where customer is not null;
create index if not exists equipment_move_requests_from_key_idx on equipment_move_requests (lower(btrim(from_customer)));
create index if not exists equipment_move_requests_to_key_idx on equipment_move_requests (lower(btrim(to_customer)));

-- 0138's function where the column is "customer"; 0141's pairs function for the two names on a move request.
drop trigger if exists wo_history_customer_id on wo_history;
create trigger wo_history_customer_id before insert or update of customer on wo_history
  for each row execute function katz_fill_customer_id();
drop trigger if exists network_accounts_customer_id on network_accounts;
create trigger network_accounts_customer_id before insert or update of customer on network_accounts
  for each row execute function katz_fill_customer_id();
drop trigger if exists customer_providers_customer_id on customer_providers;
create trigger customer_providers_customer_id before insert or update of customer on customer_providers
  for each row execute function katz_fill_customer_id();
drop trigger if exists invoices_customer_id on invoices;
create trigger invoices_customer_id before insert or update of customer on invoices
  for each row execute function katz_fill_customer_id();
drop trigger if exists module_stops_customer_id on module_stops;
create trigger module_stops_customer_id before insert or update of customer on module_stops
  for each row execute function katz_fill_customer_id();
drop trigger if exists equipment_move_requests_customer_ids on equipment_move_requests;
create trigger equipment_move_requests_customer_ids before insert or update of from_customer, to_customer on equipment_move_requests
  for each row execute function katz_fill_customer_ids('from_customer', 'from_customer_id', 'to_customer', 'to_customer_id');

-- The relink covers C1, C2 and C3. Replaces 0141's version (same name and arguments, so the account triggers that call
-- it stay as they are). A kept column only fills rows with no id. Each update writes only an id column, so no record
-- trigger fires. A table or column this database doesn't have is passed over.
create or replace function katz_relink_customer_keys(keys text[]) returns void language plpgsql as $$
declare
  l record;
begin
  if keys is null or cardinality(keys) = 0 then return; end if;
  for l in
    select * from (values
      ('service_jobs', 'customer', 'customer_id', false),
      ('pm_jobs', 'customer', 'customer_id', false),
      ('installs', 'customer', 'customer_id', false),
      ('deals', 'customer', 'customer_id', false),
      ('recipes', 'customer', 'customer_id', false),
      ('account_equipment', 'customer', 'customer_id', false),
      ('account_equipment_retired', 'customer', 'customer_id', false),
      ('assets', 'customer_owned', 'customer_owned_id', false),
      ('assets', 'sold_to', 'sold_to_id', false),
      ('assets', 'stock_hold_customer', 'stock_hold_customer_id', false),
      ('asset_stock_actions', 'customer', 'customer_id', true),
      ('rebuilds', 'account', 'account_id', false),
      ('modules', 'assigned_customer', 'assigned_customer_id', false),
      ('wo_history', 'customer', 'customer_id', false),
      ('network_accounts', 'customer', 'customer_id', false),
      ('customer_providers', 'customer', 'customer_id', false),
      ('invoices', 'customer', 'customer_id', true),
      ('module_stops', 'customer', 'customer_id', true),
      ('equipment_move_requests', 'from_customer', 'from_customer_id', true),
      ('equipment_move_requests', 'to_customer', 'to_customer_id', true)
    ) v(tbl, name_col, id_col, kept)
  loop
    -- A database without one of these tables or columns (an older one) passes over it, as the rename does.
    if not exists (select 1 from pg_attribute
                    where attrelid = to_regclass(l.tbl) and attname = l.id_col and not attisdropped) then
      continue;
    end if;
    if l.kept then
      execute format(
        'update %I set %I = katz_customer_id(%I)
          where lower(btrim(%I)) = any($1) and %I is null and katz_customer_id(%I) is not null',
        l.tbl, l.id_col, l.name_col, l.name_col, l.id_col, l.name_col)
        using keys;
    else
      execute format(
        'update %I set %I = katz_customer_id(%I)
          where lower(btrim(%I)) = any($1) and %I is distinct from katz_customer_id(%I)',
        l.tbl, l.id_col, l.name_col, l.name_col, l.id_col, l.name_col)
        using keys;
    end if;
  end loop;
end $$;
