-- Pre-inspection: each unit on a visit is a new install or replaces equipment already on the account.
-- When it replaces a unit and the site requirements are the same, that unit's results are copied here.
alter table install_inspection_units add column if not exists visit_kind text;          -- 'new' | 'replace'; null = new
alter table install_inspection_units add column if not exists reqs_same boolean;        -- replace only: same site requirements?
alter table install_inspection_units add column if not exists copied_from_install int;
alter table install_inspection_units add column if not exists copied_from_equipment int;
alter table install_inspection_units add column if not exists core_model text;          -- model whose core hole is already in the counter
