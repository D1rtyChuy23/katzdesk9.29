-- A PM billed in NetSuite on its own (the Billing Backfill put a live NetSuite invoice on it, or NetSuite's Sales Order
-- or lines, 0116): it can't be stacked on a ticket, or the ticket would bill it again (11/5 review). Volatile, like
-- pm_own_invoice_has_lines (0094): the stack reads it with a fresh snapshot, so a Write that committed while the stack
-- waited for the PM's lock is seen. Its own file, so a database that ran 0116 before this was added gets it too.
create or replace function pm_netsuite_billed(pm int) returns boolean language sql volatile as $$
  select exists (
    select 1 from record_ns_invoices x
     where x.pm_id = pm and lower(regexp_replace(x.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void')
  ) or exists (
    select 1 from record_ns_billing b
     where b.pm_id = pm
       and (nullif(btrim(b.ns_so), '') is not null or exists (select 1 from record_ns_charges c where c.billing_id = b.id))
  )
$$;
