-- Recipe tea slots + service-call urgency

alter table recipes add column if not exists tea_1 text;
alter table recipes add column if not exists tea_2 text;

alter table service_jobs add column if not exists urgency text not null default 'Normal';

-- ITCB / TB3 brew cards belong on Tea, not Coffee
update recipes
set
  tea_1 = coalesce(nullif(tea_1, ''), coffee_1),
  tea_2 = coalesce(nullif(tea_2, ''), coffee_2),
  coffee_1 = null,
  coffee_2 = null,
  coffee_3 = null
where equipment_model in ('Bunn ITCB', 'Bunn TB3')
  and coalesce(tea_1, '') = '';

-- Stale open service calls start as High so the board isn't all Normal
update service_jobs
set urgency = 'High'
where kind = 'service'
  and done = false
  and status not in ('Completed', 'Cancelled', 'Phone Resolved')
  and received is not null
  and received <= (current_date - 2)
  and urgency = 'Normal';
