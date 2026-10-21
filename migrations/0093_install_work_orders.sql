-- One install project can carry several Corrigo work orders (a multi-day job: WO-0831, WO-0855, ...).
-- installs.wo stays the first (primary) WO; every WO the install carries has a row here, the primary included.
-- match_key is the WO's match key (woMatchKey: "WO-0855" → "855"), so each number is on an install once.
create table if not exists install_work_orders (
  id            serial primary key,
  install_id    int not null references installs(id) on delete cascade,
  wo            text not null,
  match_key     text not null,
  -- Corrigo's Operational Status for this WO, as the file wrote it.
  status        text,
  completed_at  date,
  received      date,
  -- 'corrigo', 'desk', 'merge' or 'backfill'.
  source        text,
  added_by      text,
  added_at      timestamptz not null default now(),
  unique (install_id, match_key)
);
create index if not exists install_work_orders_key_idx on install_work_orders (match_key);

-- Today's WO on each install becomes its first row. A completed install's WO counts as completed.
insert into install_work_orders (install_id, wo, match_key, status, completed_at, received, source)
select id, wo, case when core ~ '^[0-9]+$' then coalesce(nullif(ltrim(core, '0'), ''), '0') else core end,
       case when complete then 'Completed' end, completed_at, received, 'backfill'
  from (
    select id, btrim(wo) as wo, complete, completed_at, received,
           upper(regexp_replace(
             regexp_replace(regexp_replace(btrim(wo), ',', '', 'g'), '^(work\s*order|w\.?o\.?|s\.?t\.?)[#.:\s-]*#?', '', 'i'),
             '[\s-]+', '', 'g')) as core
      from installs
     where coalesce(btrim(wo), '') <> ''
  ) w
 where core <> ''
on conflict (install_id, match_key) do nothing;

-- The owner can lock an install's customer: nobody changes it until the owner unlocks it.
alter table installs add column if not exists customer_locked_at timestamptz;
alter table installs add column if not exists customer_locked_by text;
