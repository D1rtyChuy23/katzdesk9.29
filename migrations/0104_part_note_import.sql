-- Import Part Notes (Grok's request through Chuy, 2026-10-29): Parts → Import → Import Part Notes (CSV), Admin only,
-- adds lines to a part's note (billing_items.note, the field the merge file writes). Each Confirm is logged here as
-- kind 'notes', with what it added, skipped and didn't find. Nothing existing changes: the two new counts start at 0.
alter table part_import_runs drop constraint if exists part_import_runs_kind_check;
alter table part_import_runs add constraint part_import_runs_kind_check check (kind in ('parts', 'pricing', 'notes'));
alter table part_import_runs add column if not exists skipped int not null default 0;
alter table part_import_runs add column if not exists not_found int not null default 0;
