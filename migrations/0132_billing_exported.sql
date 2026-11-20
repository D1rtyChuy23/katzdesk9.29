-- Export Billing records each download (Chuy, 11/19; Data Flow Check bug 4). Until a ticket's Sales Order or NetSuite
-- invoice came back, the next export with an overlapping window listed it again. When and by whom a ticket was last
-- exported: the next build leaves it out and lists it, unless "Include already exported" is ticked. Additive only:
-- two nullable columns, blank on every ticket today.
alter table service_jobs add column if not exists billing_exported_at timestamptz;
alter table service_jobs add column if not exists billing_exported_by text;
