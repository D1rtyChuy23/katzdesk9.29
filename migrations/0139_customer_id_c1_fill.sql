-- Customers by id, phase C1, part 2: fill customer_id on the records already there, by the rule in 0138. Its own file so
-- the table locks 0138 takes are short; this one takes row locks only. Each update writes only the new column, so no
-- record trigger fires and no name, date or other column changes.

set local lock_timeout = '15s';
-- The accounts hold still while the rows are filled (an account removed mid-fill would leave its id on rows not yet
-- reached); reads go on, writes to the account list wait the few seconds this takes.
lock table directory_customers in share mode;

update service_jobs set customer_id = katz_customer_id(customer) where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update pm_jobs set customer_id = katz_customer_id(customer) where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update installs set customer_id = katz_customer_id(customer) where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update deals set customer_id = katz_customer_id(customer) where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;
update recipes set customer_id = katz_customer_id(customer) where customer_id is null and coalesce(btrim(customer), '') <> '' and katz_customer_id(customer) is not null;

-- The id indexes after the fill, so the fill doesn't keep them up row by row.
create index if not exists service_jobs_customer_id_idx on service_jobs (customer_id);
create index if not exists pm_jobs_customer_id_idx on pm_jobs (customer_id);
create index if not exists installs_customer_id_idx on installs (customer_id);
create index if not exists deals_customer_id_idx on deals (customer_id);
create index if not exists recipes_customer_id_idx on recipes (customer_id);
