-- Part merges (10/28, Grok's request through Chuy). One part kept for a number that was on two rows:
--   * merged_into: the part this row was folded into (an import copy, or an old number merged into a new one). The row
--     stays, hidden; it is never deleted. Usage, the part pickers and the Parts search read it as its keeper.
--   * previous_numbers: the old numbers merged into this part, so searching one finds it.
--   * note: why parts were merged into this one, from the merge file.
alter table billing_items add column if not exists merged_into int references billing_items (id);
alter table billing_items add column if not exists previous_numbers text[] not null default '{}';
alter table billing_items add column if not exists note text;
create index if not exists billing_items_merged_into_idx on billing_items (merged_into) where merged_into is not null;
