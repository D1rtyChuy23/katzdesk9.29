-- A hidden part leaves the Parts list and the pickers, but the row stays.
-- `active` is not the marker: the NetSuite item import writes `active` and would bring a hidden part back.

alter table billing_items add column if not exists hidden_at timestamptz;
alter table billing_items add column if not exists hidden_by text;
alter table billing_items add column if not exists hidden_reason text;

create index if not exists billing_items_hidden_idx on billing_items (hidden_at) where hidden_at is not null;
