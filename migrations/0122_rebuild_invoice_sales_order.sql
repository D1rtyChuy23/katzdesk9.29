-- A rebuild's approved invoice may be on a Sales Order in NetSuite already (Chuy, 11/6: "I can approve sales orders in
-- netsuite and then convert them to invoices to pull all items from inventory and to bill"). Linking such a rebuild to a
-- ticket or an install, Link asks. Not yet: its lines move onto the project's bill, as before. Yes: they stay on its own
-- invoice, which bills on that Sales Order, and only its later parts and labor go on the project.
--
-- The answer is kept on the invoice: who said so, when, and the invoice's version then (invoice_version). It counts
-- only while the version is the same: an approve or a save for approval after it changes the version, and Link asks
-- again. Null on every invoice before this. Only adds three columns and a function.
alter table invoices add column if not exists on_sales_order_at timestamptz;
alter table invoices add column if not exists on_sales_order_by text;
alter table invoices add column if not exists on_sales_order_version text;

-- Whether a rebuild's own invoice is on a Sales Order, as an Admin said at Link, and unchanged since: approved, with
-- lines, at the version they saw. Volatile, so a statement that waited for a lock reads it as it is now.
create or replace function rebuild_invoice_on_so(rb int) returns boolean language sql volatile as $$
  select coalesce((
    select v.approved_at is not null
           and v.on_sales_order_version is not null
           and v.on_sales_order_version = invoice_version('rebuild', rb)
           and exists (select 1 from invoice_lines l where l.invoice_id = v.id)
      from invoices v
     where v.entity_type = 'rebuild' and v.entity_id = rb
  ), false)
$$;
