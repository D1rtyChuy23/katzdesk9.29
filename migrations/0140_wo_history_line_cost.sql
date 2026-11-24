-- QuickBooks cost on Work Order History lines (Jesus, 11/24): each part or filter line of a QuickBooks-era work order
-- can take the cost it had when it was billed, from QuickBooks vendor purchase history (Tickets → Import → Update
-- History Line Costs). Additive only: every new column starts null; no backfill; no existing value changes.
--
-- Labor, trip and discount lines never take a cost (this data has none, and today's Labor Cost Rate is
-- never used on history). Cost and profit are shown only to the people Settings → Who Sees Cost and Margin allows.

alter table wo_history_lines add column if not exists unit_cost   numeric(12, 4);  -- QuickBooks purchase cost per unit
alter table wo_history_lines add column if not exists line_cost   numeric(12, 2);  -- qty × unit_cost, rounded
alter table wo_history_lines add column if not exists cost_basis  text;            -- 'last_on_or_before' | 'first_after' | 'wtd_avg'
alter table wo_history_lines add column if not exists cost_date   date;            -- the purchase it came from (null for wtd_avg)
alter table wo_history_lines add column if not exists cost_source text;            -- 'quickbooks'
alter table wo_history_lines add column if not exists cost_flag   text;            -- e.g. 'Non-parts QB category', 'Cost from later purchase'
alter table wo_history_lines add column if not exists cost_run_id int references wo_history_runs (id) on delete set null;
-- What the run wrote, as one text (unit|line|basis|date|source|flag), so Undo clears a line only while it still holds
-- exactly that and leaves a later hand edit alone. A column, not a table.
alter table wo_history_lines add column if not exists cost_run_values text;
create index if not exists wo_history_lines_cost_run_idx on wo_history_lines (cost_run_id) where cost_run_id is not null;

alter table wo_history_runs add column if not exists kind text not null default 'history';  -- 'history' | 'line_costs'
