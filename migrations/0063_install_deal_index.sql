-- Deal -> Board: a deal can have more than one board project (one install row each), so installs are looked up
-- by deal. Which machines a project holds stays in the machine rows (installs.machines, deals.machines).
create index if not exists installs_deal_idx on installs (deal_id) where deal_id is not null;
