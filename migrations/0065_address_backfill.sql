-- Addresses read from the clean customer list onto approved accounts that are still blank, so the address is on
-- the account (and every page that shows it), not only on the Clean Names report. Only blanks are filled; no name,
-- lock or other field is changed.
update directory_customers d
   set address = i.address, updated_at = now()
  from (
    select distinct on (customer_id) customer_id, btrim(address) as address
      from customer_clean_items
     where customer_id is not null
       and coalesce(btrim(address), '') <> ''
       and status in ('apply', 'locked', 'kept')
     order by customer_id, id desc
  ) i
 where d.id = i.customer_id
   and coalesce(btrim(d.address), '') = '';
