-- Parts keep one of six classes: Parts, Water Filters, Cleaning Material, Equipment, Service, Discounts.
-- Same rules as the NetSuite parts import (partClassFor in part-pricing.ts), applied to parts already listed:
-- Dispensers fold into Equipment; a discount is Discounts; an item under the WF parent is a Water Filter; a cleaning
-- chemical or tool is Cleaning Material; any other Water Filter (the rest of the Filters tab) is Parts.
-- Blue Island items come off the active list. Nothing is deleted and no MPN changes.
update billing_items set item_class = case
  when coalesce(description, '') ~* '\mdiscount\M' or sku ~* '\mdiscount\M' then 'Discounts'
  when item_class = 'Service' then 'Service'
  when sku ~* '^WF' then 'Water Filters'
  when coalesce(description, '') ~* '\m(cleaner|detergent|descal\w*|decalcif\w*|cafiza|urnex|rinza|tabz|grindz|sanitiz\w*)\M'
    or (coalesce(description, '') ~* '\m(cleaning (brush|tool|key|kit|cloth|pad)|clean ?out tool|brush(es)?)\M'
        and coalesce(description, '') !~* 'brush kit assembly|motor brush|carbon brush') then 'Cleaning Material'
  when item_class = 'Dispensers' then 'Equipment'
  when item_class = 'Water Filters' then 'Parts'
  else item_class end
 where item_class is not null;

update billing_items set active = false
 where hidden_at is null and active
   and (sku ~* '^blue ?island' or coalesce(description, '') ~* '^blue ?island');
