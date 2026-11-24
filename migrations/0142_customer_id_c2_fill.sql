-- Customers by id, phase C2, part 2: fill the ids 0141 added on the records already there, by the rule in 0138. Its
-- own file so the table locks 0141 takes are short; this one takes row locks only. Each update writes only an id
-- column, so no record trigger fires (no equipment history row, no serial check) and no name or date changes.

set local lock_timeout = '15s';
-- The accounts hold still while the rows are filled (an account removed mid-fill would leave its id on rows not yet
-- reached); reads go on, writes to the account list wait the few seconds this takes.
lock table directory_customers in share mode;

update account_equipment set customer_id = katz_customer_id(customer)
 where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update account_equipment_retired set customer_id = katz_customer_id(customer)
 where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update assets set customer_owned_id = katz_customer_id(customer_owned)
 where customer_owned_id is null and coalesce(btrim(customer_owned), '') <> '' and katz_customer_id(customer_owned) is not null;
update assets set sold_to_id = katz_customer_id(sold_to)
 where sold_to_id is null and coalesce(btrim(sold_to), '') <> '' and katz_customer_id(sold_to) is not null;
update assets set stock_hold_customer_id = katz_customer_id(stock_hold_customer)
 where stock_hold_customer_id is null and coalesce(btrim(stock_hold_customer), '') <> '' and katz_customer_id(stock_hold_customer) is not null;
update asset_stock_actions set customer_id = katz_customer_id(customer)
 where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update rebuilds set account_id = katz_customer_id(account)
 where account_id is null and coalesce(btrim(account), '') <> '' and katz_customer_id(account) is not null;
update modules set assigned_customer_id = katz_customer_id(assigned_customer)
 where assigned_customer_id is null and coalesce(btrim(assigned_customer), '') <> '' and katz_customer_id(assigned_customer) is not null;

-- The id indexes after the fill, so the fill doesn't keep them up row by row.
create index if not exists account_equipment_customer_id_idx on account_equipment (customer_id);
create index if not exists account_equipment_retired_customer_id_idx on account_equipment_retired (customer_id);
create index if not exists assets_customer_owned_id_idx on assets (customer_owned_id) where customer_owned_id is not null;
create index if not exists assets_sold_to_id_idx on assets (sold_to_id) where sold_to_id is not null;
create index if not exists assets_stock_hold_customer_id_idx on assets (stock_hold_customer_id) where stock_hold_customer_id is not null;
create index if not exists asset_stock_actions_customer_id_idx on asset_stock_actions (customer_id) where customer_id is not null;
create index if not exists rebuilds_account_id_idx on rebuilds (account_id);
create index if not exists modules_assigned_customer_id_idx on modules (assigned_customer_id) where assigned_customer_id is not null;
