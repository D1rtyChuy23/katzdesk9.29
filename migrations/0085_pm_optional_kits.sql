-- Kits a tech adds onto a shorter PM, from the longest interval. Not ticks: clearing ticks leaves them.
-- One list per PM unit. A bench module service keeps its own. Nothing is deleted.

alter table pm_runbook_units add column if not exists added_kits jsonb not null default '[]';
alter table module_runbook_services add column if not exists added_kits jsonb not null default '[]';
