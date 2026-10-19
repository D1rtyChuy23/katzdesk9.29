-- One account unit is linked to an install at most once.
-- The primary key already enforces this. The named unique index keeps that rule
-- even if a later change rebuilds the table without the primary key.
create unique index if not exists install_inspection_units_once
  on install_inspection_units (install_id, equipment_id);
