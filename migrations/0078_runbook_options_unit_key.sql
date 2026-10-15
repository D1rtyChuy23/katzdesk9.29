-- Runbook options need a key for units that have no serial yet. unit_key is the normalised serial when there is
-- one, else 'acct:<account_equipment id>'. When a serial is added the app renames the row (history stays attached).
alter table unit_runbook_options add column if not exists unit_key text;
update unit_runbook_options set unit_key = serial_key where unit_key is null;
alter table unit_runbook_options alter column unit_key set not null;
create unique index if not exists unit_runbook_options_unit_key_idx on unit_runbook_options (unit_key);
alter table unit_runbook_options alter column serial_key drop not null;
