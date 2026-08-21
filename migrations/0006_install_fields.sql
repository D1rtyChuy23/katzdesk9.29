-- Manual install fields + origin rack slot for returning assigned units.
-- serial / power_voltage stay empty unless a person types them.

alter table installs add column if not exists serial text;
alter table installs add column if not exists power_voltage text;

alter table assets add column if not exists origin_site text;
alter table assets add column if not exists origin_pallet text;
alter table assets add column if not exists origin_level int;
