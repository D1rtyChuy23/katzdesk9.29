-- Faema replaced the X20's PPM kits A-I with the CBM kits B, E1, E2, E3, M, EM and C (Service Bulletin #S022).
-- Hide the X20-only PPM kits so they leave the Parts list and pickers. The rows stay, Unhide brings one back, and the
-- NetSuite item import leaves a hidden part hidden. The X20/X30 kit B (FA981901010) stays: the X30 still uses it.
update billing_items
   set hidden_at = now(),
       hidden_by = 'Claude',
       hidden_reason = 'Old X20 PPM kit, replaced by the CBM kits (Faema bulletin S022)',
       updated_at = now()
 where hidden_at is null
   and upper(btrim(sku)) in ('FA981900000', 'FA981902000', 'FA981907000', 'FA981908020', 'FA981909010', 'FA981945000');
