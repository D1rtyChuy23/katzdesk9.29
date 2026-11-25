-- Customers by id, phase C4 ("One Record Per Machine Plan", Chuy approved 11/24): an invoice whose name finds no
-- account takes the account of the record it bills, when that account is known to have had the name. The rename and
-- merge changes of C4 are in customer-identity.ts; this is the one data change.
--
-- An invoice keeps the name it was billed under (choice 2). One billed under a name its account gave up before C3 (a
-- rename or a merge) found no account when 0146 filled the ids, so it has none. The ticket, PM, install, rebuild or deal
-- it bills followed the account. A record can also have moved to another account since it was billed (a rebuild's
-- account changes while its Sales Order keeps the name it billed), so the record's account is only taken when that
-- account is known to have had the invoice's name:
--   - the Clean Names report listed the account under that name (customer_clean_items.katz_name), or
--   - the account's history says it was renamed from that name, or that an account with that name was merged into it
--     (the lines customer-identity.ts and wo-history-api.ts write: Renamed from “…”, “…” (#n) was merged into this
--     account, the old account “…” (#n) was merged into it).
-- Only invoices with no id, a name that isn't blank, and a name that finds no account by 0138's rule now. Anything else
-- is left as it is: Link Check lists it. A wrong id would be kept (history rows keep theirs), so this fills only on
-- that evidence. Each update writes only customer_id, so no trigger runs and no name or date changes.

set local lock_timeout = '15s';
-- The accounts hold still while the rows are filled (reads go on; writes to the account list wait).
lock table directory_customers in share mode;

with known as (
  -- Names an account's records were filed under: its own old names, and those of accounts merged into it.
  select c.customer_id as id, lower(btrim(c.katz_name)) as k
    from customer_clean_items c
   where c.customer_id is not null and coalesce(btrim(c.katz_name), '') <> ''
  union
  select a.entity_id, lower(btrim(n.name))
    from activity a,
         lateral (values
           (substring(a.detail from '^Renamed from “(.+?)”')),
           (substring(a.detail from '^“(.+?)” \(#[0-9]+\) was merged into this account')),
           (substring(a.detail from 'the old account “(.+?)” \(#[0-9]+\) was merged into it'))
         ) n(name)
   where a.entity_type = 'customer' and coalesce(btrim(n.name), '') <> ''
), billed as (
  select 'service'::text as t, id, customer_id as account from service_jobs
  union all select 'tlc', id, customer_id from service_jobs
  union all select 'pm', id, customer_id from pm_jobs
  union all select 'install', id, customer_id from installs
  union all select 'rebuild', id, account_id from rebuilds
  union all select 'deal', id, customer_id from deals
)
update invoices i set customer_id = b.account
  from billed b
 where b.t = i.entity_type and b.id = i.entity_id and b.account is not null
   and i.customer_id is null and coalesce(btrim(i.customer), '') <> '' and katz_customer_id(i.customer) is null
   and exists (select 1 from known k where k.id = b.account and k.k = lower(btrim(i.customer)));
