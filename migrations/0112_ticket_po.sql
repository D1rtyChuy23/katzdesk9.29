-- A Customer P.O. and a Vendor P.O. on every ticket (Chuy, 11/2): "can you add PO to all tickets? this will help match
-- some up like the TLCs or Installs or Repos. Even ones that a vendor provides their PO number to use for reference."
-- Both are typed on the record's Details, shown on its card and found by search. The Customer P.O. goes on the record's
-- invoice; the Vendor P.O. is for reference only.
--
-- Service and TLC tickets keep their Customer P.O. where it already is (service_jobs.po, on the NetSuite billing
-- export). PMs, installs, rebuilds and deals get their own.
alter table service_jobs add column if not exists vendor_po text;
alter table pm_jobs add column if not exists po text;
alter table pm_jobs add column if not exists vendor_po text;
alter table installs add column if not exists po text;
alter table installs add column if not exists vendor_po text;
alter table rebuilds add column if not exists po text;
alter table rebuilds add column if not exists vendor_po text;
alter table deals add column if not exists po text;
alter table deals add column if not exists vendor_po text;

-- An install's P.O. was on its invoice (migration 0107); it is the install's own now, so the Details tab and the Invoice
-- window show the same one. invoices.po stays as it was: the site before this reads it while this publish builds, and
-- from now on it keeps the P.O. each invoice was last approved with.
update installs i
   set po = btrim(v.po)
  from invoices v
 where v.entity_type = 'install' and v.entity_id = i.id
   and nullif(btrim(v.po), '') is not null
   and nullif(btrim(i.po), '') is null;
