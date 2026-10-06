-- Pre-inspection: a unit that is existing equipment on the account is already pre-inspected.
-- visit_kind gains 'existing'. A note can be kept on the unit without inspecting each utility.
alter table install_inspection_units add column if not exists note text;
