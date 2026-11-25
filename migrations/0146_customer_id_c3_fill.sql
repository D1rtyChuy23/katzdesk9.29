-- Customers by id, phase C3, part 2: fill the ids 0145 added on the rows already there, by the rule in 0138. Its own
-- file, as in C1 and C2, so 0145's locks are held only while it adds the columns and indexes; the fill takes row
-- locks, and the id indexes at the end briefly hold writes to their tables while they build. Each update writes only
-- an id column, so no name trigger fires and no name or date changes. A history row's name is the one it had then;
-- one that finds no account today stays without an id.

set local lock_timeout = '15s';
-- The accounts hold still while the rows are filled (reads go on; writes to the account list wait).
lock table directory_customers in share mode;

update wo_history set customer_id = katz_customer_id(customer)
 where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update network_accounts set customer_id = katz_customer_id(customer)
 where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update customer_providers set customer_id = katz_customer_id(customer)
 where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update invoices set customer_id = katz_customer_id(customer)
 where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update module_stops set customer_id = katz_customer_id(customer)
 where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update equipment_move_requests set from_customer_id = katz_customer_id(from_customer)
 where from_customer_id is null and coalesce(btrim(from_customer), '') <> '' and katz_customer_id(from_customer) is not null;
update equipment_move_requests set to_customer_id = katz_customer_id(to_customer)
 where to_customer_id is null and coalesce(btrim(to_customer), '') <> '' and katz_customer_id(to_customer) is not null;

create index if not exists wo_history_customer_id_idx on wo_history (customer_id);
create index if not exists network_accounts_customer_id_idx on network_accounts (customer_id);
create index if not exists customer_providers_customer_id_idx on customer_providers (customer_id);
create index if not exists invoices_customer_id_idx on invoices (customer_id) where customer_id is not null;
create index if not exists module_stops_customer_id_idx on module_stops (customer_id) where customer_id is not null;
create index if not exists equipment_move_requests_from_id_idx on equipment_move_requests (from_customer_id);
create index if not exists equipment_move_requests_to_id_idx on equipment_move_requests (to_customer_id);
