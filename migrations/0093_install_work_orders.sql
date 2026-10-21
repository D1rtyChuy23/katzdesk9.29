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
-- The key is read the way woMatchKey reads it: Unicode dashes and no-break spaces as plain ones, commas dropped,
-- "WO" / "ST" / "Work Order" / "#" prefixes dropped (repeated), spaces and dashes dropped, "855.0" as 855, and a
-- number without its leading zeros.
insert into install_work_orders (install_id, wo, match_key, status, completed_at, received, source)
select id, wo, case when core ~ '^[0-9]+$' then coalesce(nullif(ltrim(core, '0'), ''), '0') else core end,
       case when complete then 'Completed' end, completed_at, received, 'backfill'
  from (
    select id, wo, complete, completed_at, received,
           case when core0 ~ '^[0-9]+\.0+$' then regexp_replace(core0, '\.0+$', '') else core0 end as core
      from (
        select id, btrim(wo, E' \t\r\n' || U&'\00A0\202F\2007\2009') as wo, complete, completed_at, received,
               regexp_replace(
                 regexp_replace(
                   regexp_replace(
                     upper(btrim(translate(wo, U&'\00A0\202F\2007\2009\2010\2011\2012\2013\2014\2015\2212', '    -------'), E' \t\r\n')),
                     ',', '', 'g'),
                   '^((WORK\s*ORDER|W\.?O\.?|S\.?T\.?)[#.:\s-]*|#)+', ''),
                 '[\s-]+', '', 'g') as core0
          from installs
         where coalesce(btrim(wo, E' \t\r\n' || U&'\00A0\202F\2007\2009'), '') <> ''
      ) k
  ) w
 where core <> ''
on conflict (install_id, match_key) do nothing;

-- The owner can lock an install's customer: nobody changes it until the owner unlocks it.
alter table installs add column if not exists customer_locked_at timestamptz;
alter table installs add column if not exists customer_locked_by text;
