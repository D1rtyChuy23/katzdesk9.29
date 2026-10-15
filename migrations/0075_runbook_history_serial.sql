-- PM history follows the equipment through its life: store the normalised serial on each PM's ticks and unit
-- choices so a unit's earlier PMs are found by serial even after it moves to another account. Rows for a unit
-- with no serial yet are filled in when the serial is added (see getPmRunbook).
alter table pm_runbook_units add column if not exists serial_key text;
alter table pm_runbook_checks add column if not exists serial_key text;
create index if not exists pm_runbook_units_serial_idx on pm_runbook_units (serial_key) where serial_key is not null;
create index if not exists pm_runbook_checks_serial_idx on pm_runbook_checks (serial_key) where serial_key is not null;
