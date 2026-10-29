-- Warehouse refurb invoices (Chuy, 2026-10-29). A warehouse user saves the parts a refurb used on a rebuild billed to
-- Katz Coffee Service Dept., and an Admin approves it. Saved but not approved yet is "waiting for approval": who saved
-- it and when. Nothing existing changes: every invoice so far was written when it was approved, so both columns start
-- blank on all of them.
alter table invoices add column if not exists submitted_by text;
alter table invoices add column if not exists submitted_at timestamptz;
