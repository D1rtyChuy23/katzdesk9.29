-- Parts keep one of five classes: Parts, Water Filters, Service, Equipment, Dispensers.
-- The NetSuite class path is kept as it was read (source_class). The five classes come from the file's tabs, so the
-- part-and-filter parts are all "Parts" here until the items file is imported again (it moves the filters to Water
-- Filters). Parts from a class outside the five come off the active list; nothing is deleted and no MPN changes.
alter table billing_items add column if not exists source_class text;

update billing_items set source_class = item_class where source_class is null and item_class is not null;

update billing_items set item_class = case
  when item_class in ('Parts', 'Water Filters', 'Service', 'Equipment', 'Dispensers') then item_class
  when lower(item_class) like 'service%' then 'Service'
  when lower(item_class) like 'equipment : parts%' then 'Parts'
  when lower(item_class) like 'equipment%' then 'Equipment'
  else null end
 where item_class is not null;

update billing_items set active = false
 where source_class is not null and item_class is null and hidden_at is null;
