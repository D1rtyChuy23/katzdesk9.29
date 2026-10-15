-- Where a part sits in the stockroom: Rack, Shelf and Bin. Typed in the part's window on Parts, or filled in from a
-- Bin Locations file (CSV or Excel). A blank piece is stored as null and means "not set".
alter table billing_items add column if not exists bin_rack text;
alter table billing_items add column if not exists bin_shelf text;
alter table billing_items add column if not exists bin_bin text;
-- When the bin location last changed, and the Desk username of the person who changed it.
alter table billing_items add column if not exists bin_updated_at timestamptz;
alter table billing_items add column if not exists bin_updated_by text;
