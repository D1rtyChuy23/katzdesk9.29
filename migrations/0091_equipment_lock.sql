-- Owner-controlled lock on equipment. A locked account unit or warehouse asset can't be moved, returned, sold,
-- removed or merged until the desk owner unlocks it. locked_by is the person, or "System (...)" for the lock an
-- assignment or a sale puts on by itself.
alter table account_equipment add column if not exists locked_at timestamptz;
alter table account_equipment add column if not exists locked_by text;
alter table assets add column if not exists locked_at timestamptz;
alter table assets add column if not exists locked_by text;

-- Today an assigned or sold unit is locked by its status. That lock carries over as a stamped lock.
update assets
   set locked_at = now(), locked_by = 'System (assigned or sold)'
 where status in ('assigned', 'sold') and locked_at is null;

-- The install whose pre-inspection load made the account row. The prune deletes only rows its own install made;
-- a unit that was on the account before (imported, added by hand) is only taken off the visit.
alter table account_equipment add column if not exists created_by_install integer;
