-- The Profit report (11/20) matches every bill line to its part by item name or SKU (lower(btrim(...)) on both). SKU has
-- an index (billing_items_sku_uidx); this gives the item name one too, so a year of bills doesn't scan the parts list
-- once per line. Only adds an index; nothing existing changes.
create index if not exists billing_items_item_lower_idx on billing_items (lower(btrim(item)));
