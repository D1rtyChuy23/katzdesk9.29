-- Merge into install for a ticket billed on NetSuite invoices with no Sales Order (Chuy, 10/30). Its charges stay
-- billed on those invoices, the way a ticket billed on an SO keeps them (0108): they never go on the install's invoice,
-- and the install shows them as billed. The merge statement checks the ticket's NetSuite invoices that aren't Voided
-- are still the ones the merge read. This reads them fresh (volatile: a new snapshot per call), so an invoice recorded
-- or voided while the merge waited for its locks counts. Nothing existing changes.
create or replace function ticket_live_ns_invoices(job int) returns text language sql volatile as $$
  select string_agg(ti.ns_invoice, ', ' order by ti.id)
    from ticket_invoices ti
   where ti.job_id = job and lower(regexp_replace(ti.status, '[^A-Za-z]+', '', 'g')) not in ('voided', 'void')
$$;
