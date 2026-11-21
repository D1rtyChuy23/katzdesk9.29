-- Cost on PM, install, rebuild and deal invoices (Chuy, 11/20: part cost and profit, PR 4). Each line's cost and margin
-- is stored when its invoice is approved in the Invoice window, and when NetSuite's lines come in through Billing
-- Backfill, as ticket lines' are (0067). Only adds columns; nothing existing changes.
--   unit_cost     per unit: the part's Purchase Price (else Our Discount Rule), labor's Labor Cost Rate, 0 for the trip
--   cost_source   purchase, rule, labor, trip or none
--   line_discount this line's share of the header discount
--   margin        qty × rate − line_discount − qty × unit_cost
--   priced_at     when it was stored; null means worked out live
alter table invoice_lines add column if not exists unit_cost numeric(12, 2);
alter table invoice_lines add column if not exists cost_source text;
alter table invoice_lines add column if not exists line_discount numeric(12, 2);
alter table invoice_lines add column if not exists margin numeric(12, 2);
alter table invoice_lines add column if not exists priced_at timestamptz;

alter table record_ns_charges add column if not exists unit_cost numeric(12, 2);
alter table record_ns_charges add column if not exists cost_source text;
alter table record_ns_charges add column if not exists line_discount numeric(12, 2);
alter table record_ns_charges add column if not exists margin numeric(12, 2);
alter table record_ns_charges add column if not exists priced_at timestamptz;
