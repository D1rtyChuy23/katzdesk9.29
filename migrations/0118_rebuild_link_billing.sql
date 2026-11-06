-- A rebuild linked to a ticket or an install bills there (Chuy, 11/6): linking it puts its invoice's lines on the
-- ticket's charges or the install's invoice, each marked rb:<rebuild>:<line>, so unlinking can take them back. Ticket
-- charges have carried a source_key since 0092; an invoice's lines get one too. Nothing existing changes.
alter table invoice_lines add column if not exists source_key text;
create index if not exists invoice_lines_source_key_idx on invoice_lines (source_key) where source_key is not null;

-- A record's invoice version, "id:approved:saved" to the microsecond, as the Invoice window reads it (VERSION_OF in
-- invoice-api.ts); null when it has none. Volatile, like pm_netsuite_billed (0117): a link reads it with a fresh
-- snapshot after taking its locks, so an approve that committed while the link waited is seen.
create or replace function invoice_version(rec_type text, rec_id int) returns text language sql volatile as $$
  select v.id::text || ':' || coalesce((extract(epoch from v.approved_at) * 1000000)::bigint::text, '')
                    || ':' || coalesce((extract(epoch from v.submitted_at) * 1000000)::bigint::text, '')
    from invoices v
   where v.entity_type = rec_type and v.entity_id = rec_id
$$;

-- How many of a rebuild's lines are on a ticket's charges (job) or on an invoice (inv), read fresh. The rebuild's id
-- is its own colon-bounded field, so rb:12: never matches rebuild 1 or 120.
create or replace function rebuild_lines_on(rb int, job int, inv int) returns int language sql volatile as $$
  select (select count(*)::int from ticket_charges c
           where job is not null and c.job_id = job
             and split_part(c.source_key, ':', 1) = 'rb' and split_part(c.source_key, ':', 2) = rb::text)
       + (select count(*)::int from invoice_lines l
           where inv is not null and l.invoice_id = inv
             and split_part(l.source_key, ':', 1) = 'rb' and split_part(l.source_key, ':', 2) = rb::text)
$$;

-- Takes a rebuild's lines off a ticket's charges (job) or an invoice (inv): deletes them and returns them, read fresh,
-- so a charges save that committed while the unlink waited for the ticket's lock is what comes back.
create or replace function take_rebuild_lines(rb int, job int, inv int)
returns table (item text, description text, qty numeric, rate numeric, line_kind text, source_key text, sort int)
language sql volatile as $$
  with t as (
    delete from ticket_charges c
     where job is not null and c.job_id = job
       and split_part(c.source_key, ':', 1) = 'rb' and split_part(c.source_key, ':', 2) = rb::text
    returning c.item, c.description, c.qty, c.rate, c.kind, c.source_key, c.sort
  ), i as (
    delete from invoice_lines l
     where inv is not null and l.invoice_id = inv
       and split_part(l.source_key, ':', 1) = 'rb' and split_part(l.source_key, ':', 2) = rb::text
    returning l.item, l.description, l.qty, l.rate, l.kind, l.source_key, l.sort
  )
  select * from t union all select * from i
$$;

-- An invoice's total as invoiceTotals works it out: the lines' subtotal (each rounded to the cent), less the header
-- discount (a percent of it, or an amount, never more than it). No tax.
create or replace function invoice_total(subtotal numeric, discount_kind text, discount_value numeric) returns numeric language sql immutable as $$
  select b.base - case
           when coalesce(discount_value, 0) <= 0 or coalesce(discount_kind, '') not in ('percent', 'amount') then 0
           else round(least(b.base, case when discount_kind = 'percent' then b.base * least(discount_value, 100) / 100 else discount_value end), 2)
         end
    from (select round(greatest(0, coalesce(subtotal, 0)), 2) as base) b
$$;
