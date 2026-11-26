-- One Record Per Machine, phase M2, part 2: the machine for every row already there, by 0147's katz_link_machine_of.
-- Its own file so 0147's table locks are short. Each update writes only machine_id, so no row's link trigger runs and
-- nothing else is recorded (the install visit history records adds, removals and the visit kind only).

set local lock_timeout = '15s';
-- The units, warehouse records and machines hold still while the rows are filled (reads go on; saves wait).
lock table account_equipment, assets, machines in share mode;

update ticket_units t set machine_id = katz_link_machine_of('ticket_units', to_jsonb(t))
 where machine_id is null and katz_link_machine_of('ticket_units', to_jsonb(t)) is not null;
update install_inspection_units t set machine_id = katz_link_machine_of('install_inspection_units', to_jsonb(t))
 where machine_id is null and katz_link_machine_of('install_inspection_units', to_jsonb(t)) is not null;
update pm_runbook_unit_links t set machine_id = katz_link_machine_of('pm_runbook_unit_links', to_jsonb(t))
 where machine_id is null and katz_link_machine_of('pm_runbook_unit_links', to_jsonb(t)) is not null;
update pm_runbook_units t set machine_id = katz_link_machine_of('pm_runbook_units', to_jsonb(t))
 where machine_id is null and katz_link_machine_of('pm_runbook_units', to_jsonb(t)) is not null;
update machine_parts t set machine_id = katz_link_machine_of('machine_parts', to_jsonb(t))
 where machine_id is null and katz_link_machine_of('machine_parts', to_jsonb(t)) is not null;
update modules t set machine_id = katz_link_machine_of('modules', to_jsonb(t))
 where machine_id is null and katz_link_machine_of('modules', to_jsonb(t)) is not null;
update equipment_move_requests t set machine_id = katz_link_machine_of('equipment_move_requests', to_jsonb(t))
 where machine_id is null and katz_link_machine_of('equipment_move_requests', to_jsonb(t)) is not null;
update rebuild_machines t set machine_id = katz_link_machine_of('rebuild_machines', to_jsonb(t))
 where machine_id is null and katz_link_machine_of('rebuild_machines', to_jsonb(t)) is not null;

-- The machine_id indexes after the fill.
create index if not exists ticket_units_machine_idx on ticket_units (machine_id) where machine_id is not null;
create index if not exists install_inspection_units_machine_idx on install_inspection_units (machine_id) where machine_id is not null;
create index if not exists pm_runbook_unit_links_machine_idx on pm_runbook_unit_links (machine_id) where machine_id is not null;
create index if not exists pm_runbook_units_machine_idx on pm_runbook_units (machine_id) where machine_id is not null;
create index if not exists machine_parts_machine_idx on machine_parts (machine_id) where machine_id is not null;
create index if not exists modules_machine_idx on modules (machine_id) where machine_id is not null;
create index if not exists equipment_move_requests_machine_idx on equipment_move_requests (machine_id) where machine_id is not null;
create index if not exists rebuild_machines_machine_idx on rebuild_machines (machine_id) where machine_id is not null;
