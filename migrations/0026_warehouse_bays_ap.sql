-- Relabel warehouse bays B–Q → A–P (shift one letter down).
update assets
  set pallet = chr(ascii(upper(btrim(pallet))) - 1)
  where pallet is not null and length(btrim(pallet)) = 1 and upper(btrim(pallet)) ~ '^[B-Q]$';
update assets
  set origin_pallet = chr(ascii(upper(btrim(origin_pallet))) - 1)
  where origin_pallet is not null and length(btrim(origin_pallet)) = 1 and upper(btrim(origin_pallet)) ~ '^[B-Q]$';
