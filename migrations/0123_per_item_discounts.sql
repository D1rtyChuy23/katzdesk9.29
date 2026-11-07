-- Per-item discounts (Chuy, 11/7): a bill's one discount is on the Whole bill ('all', as every discount was before) or
-- on Chosen lines ('chosen'): it comes off only the lines ticked for it, and the other lines bill in full. This only
-- adds: every existing ticket and invoice reads Whole bill and every line reads unticked, so no total, approval,
-- invoice version or Sales Order note changes. Tickets keep their discount on service_jobs, the other records on
-- invoices; their lines are ticket_charges and invoice_lines.
alter table service_jobs add column if not exists discount_scope text not null default 'all';
alter table service_jobs drop constraint if exists service_jobs_discount_scope_check;
alter table service_jobs add constraint service_jobs_discount_scope_check check (discount_scope in ('all', 'chosen'));
alter table invoices add column if not exists discount_scope text not null default 'all';
alter table invoices drop constraint if exists invoices_discount_scope_check;
alter table invoices add constraint invoices_discount_scope_check check (discount_scope in ('all', 'chosen'));
-- The line's tick, read only when its bill's discount is on Chosen lines. A line added anywhere comes in unticked.
alter table ticket_charges add column if not exists discount_chosen boolean not null default false;
alter table invoice_lines add column if not exists discount_chosen boolean not null default false;

-- A bill's total as billTotals works it out: the lines' subtotal (each rounded to the cent), less the discount taken off
-- the base, what the lines the discount comes off add up to (a percent of it, or an amount, never more than it). The
-- base is held between 0 and the subtotal. invoice_total(subtotal, kind, value) from 0118 stays, for the Whole bill and
-- for pages still running while this is published.
create or replace function invoice_total(subtotal numeric, base numeric, discount_kind text, discount_value numeric) returns numeric language sql immutable as $$
  select b.sub - case
           when coalesce(discount_value, 0) <= 0 or coalesce(discount_kind, '') not in ('percent', 'amount') then 0
           else round(least(b.from_lines, case when discount_kind = 'percent' then b.from_lines * least(discount_value, 100) / 100 else discount_value end), 2)
         end
    from (select s.sub, least(round(greatest(0, coalesce(base, 0)), 2), s.sub) as from_lines
            from (select round(greatest(0, coalesce(subtotal, 0)), 2) as sub) s) b
$$;
