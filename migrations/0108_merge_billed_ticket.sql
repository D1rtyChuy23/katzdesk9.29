-- Merge into install for a ticket billed on a NetSuite Sales Order (Grok via Chuy, 10/30). Its charges stay billed on
-- that SO: they never go on the install's invoice, and the install shows them as billed. The merge statement still
-- refuses a ticket that has a repair quote or a stacked PM; this reads those two fresh (volatile: a new snapshot per
-- call, so one added while the merge waited for its locks counts). ticket_keeps_its_billing stays as it is for
-- unbilled tickets.
create or replace function ticket_has_quote_or_stacked_pm(job int) returns boolean language sql volatile as $$
  select exists (select 1 from repair_quotes q where q.job_id = job)
      or exists (select 1 from pm_jobs p where p.stacked_job_id = job)
$$;
