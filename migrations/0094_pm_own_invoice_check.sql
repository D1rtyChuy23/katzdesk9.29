-- Stacking a PM checks its own invoice with a fresh snapshot (READ COMMITTED subqueries in one statement share the
-- snapshot taken when the statement started; a VOLATILE function's queries take a new one). See stackPmSql.
create or replace function pm_own_invoice_has_lines(pm int) returns boolean language sql volatile as $$
  select exists (
    select 1 from invoices i join invoice_lines l on l.invoice_id = i.id
     where i.entity_type = 'pm' and i.entity_id = pm
  )
$$;
