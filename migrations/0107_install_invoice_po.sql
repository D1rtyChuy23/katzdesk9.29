-- A P.O. on an install's invoice (Chuy, 10/30). An approved install invoice is entered into NetSuite, which emails it
-- to the customer, so the invoice carries the customer's P.O. A ticket merged into the install brings its P.O. onto the
-- install's invoice; it is typed or changed in the Invoice window. Tickets keep theirs on the ticket (service_jobs.po).
-- Nothing existing changes: the column starts blank.
alter table invoices add column if not exists po text;
