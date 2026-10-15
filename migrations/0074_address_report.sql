-- Address Report: one decision per account the map cannot place (no pin, or only a ZIP-area pin).
-- skipped:  left off the report until someone brings it back (Bring Back deletes the row). The account is not changed.
-- approved: the account's address was set to a suggestion from the report. The account stays off the report while its
--           address still equals `address` (what was approved), even before a new location import gives it a street
--           pin, so an approved account does not keep asking. If the address changes later (for example a new clean
--           list), the account comes back to the report for a new look.
create table if not exists address_report_reviews (
  customer_id  int primary key references directory_customers (id) on delete cascade,
  status       text not null check (status in ('skipped', 'approved')),
  -- The account's address when the decision was made (after the change, for an approval).
  address      text,
  -- The suggestion that was approved, and where it came from (Geocoder match, Clean list, ...).
  suggested    text,
  source       text,
  decided_by   text,
  decided_at   timestamptz not null default now()
);
