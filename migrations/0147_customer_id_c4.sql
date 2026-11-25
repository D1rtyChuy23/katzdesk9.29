-- Customers by id, phase C4 ("One Record Per Machine Plan", Chuy approved 11/24): an invoice whose name finds no
-- account takes the account of the record it bills. The rename and merge changes of C4 are in customer-identity.ts;
-- this is the one data change.
--
-- An invoice keeps the name it was billed under (choice 2). One billed under a name its account gave up before C3 (a
-- rename or a merge) found no account when 0146 filled the ids, so it has none. The ticket, PM, install, rebuild or deal
-- it bills followed the account, so that record's account is the one it billed. Only invoices:
--   - with no id and a name that isn't blank,
--   - whose name finds no account by 0138's rule now,
--   - whose record has an account id.
-- Left as they are: an invoice whose name finds an account (0146 linked it), one whose record has no account, one with
-- no record. One case reads wrong: a record moved to another account after it was billed, whose old account was also
-- renamed or merged since. Each update writes only customer_id, so no trigger runs and no name or date changes.

set local lock_timeout = '15s';
-- The accounts hold still while the rows are filled (reads go on; writes to the account list wait).
lock table directory_customers in share mode;

update invoices i set customer_id = r.customer_id
  from service_jobs r
 where i.entity_type in ('service', 'tlc') and r.id = i.entity_id and r.customer_id is not null
   and i.customer_id is null and coalesce(btrim(i.customer), '') <> '' and katz_customer_id(i.customer) is null;

update invoices i set customer_id = r.customer_id
  from pm_jobs r
 where i.entity_type = 'pm' and r.id = i.entity_id and r.customer_id is not null
   and i.customer_id is null and coalesce(btrim(i.customer), '') <> '' and katz_customer_id(i.customer) is null;

update invoices i set customer_id = r.customer_id
  from installs r
 where i.entity_type = 'install' and r.id = i.entity_id and r.customer_id is not null
   and i.customer_id is null and coalesce(btrim(i.customer), '') <> '' and katz_customer_id(i.customer) is null;

update invoices i set customer_id = r.account_id
  from rebuilds r
 where i.entity_type = 'rebuild' and r.id = i.entity_id and r.account_id is not null
   and i.customer_id is null and coalesce(btrim(i.customer), '') <> '' and katz_customer_id(i.customer) is null;

update invoices i set customer_id = r.customer_id
  from deals r
 where i.entity_type = 'deal' and r.id = i.entity_id and r.customer_id is not null
   and i.customer_id is null and coalesce(btrim(i.customer), '') <> '' and katz_customer_id(i.customer) is null;
