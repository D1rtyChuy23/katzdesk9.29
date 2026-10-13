-- Each Eversys module is an asset with its own record: every place it has been (the trail) and the parts and
-- labor logged on it. Rows are only ever added; nothing here is overwritten or deleted with the module.

create table if not exists module_stops (
  id           serial primary key,
  module_id    int not null references modules (id) on delete restrict,
  -- assigned: put on an account's unit. returned: back to HQ. swap_out / swap_in: one module traded for another
  -- of the same type on the same unit. moved: location typed on the module record.
  kind         text not null check (kind in ('assigned', 'returned', 'swap_out', 'swap_in', 'moved')),
  customer     text,
  unit_id      int,
  unit_label   text,
  -- Swaps: the serial of the other module in the trade.
  other_module text,
  from_place   text,
  to_place     text,
  happened_at  timestamptz not null default now(),
  by_name      text,
  note         text
);
create index if not exists module_stops_module_idx on module_stops (module_id, happened_at, id);

create table if not exists module_work (
  id          serial primary key,
  module_id   int not null references modules (id) on delete restrict,
  worked_on   date not null default current_date,
  kind        text not null check (kind in ('part', 'labor')),
  item        text not null,
  description text,
  -- Parts: how many. Labor: hours.
  qty         numeric(10, 2) not null check (qty > 0),
  wo          text,
  technician  text,
  note        text,
  by_name     text,
  created_at  timestamptz not null default now()
);
create index if not exists module_work_module_idx on module_work (module_id, worked_on, id);

-- The trail so far, read once from what is already recorded: assignments and returns in the activity log, then a
-- current assignment the log does not show. Runs only while the trail is empty.
insert into module_stops (module_id, kind, customer, unit_label, to_place, from_place, happened_at, by_name, note)
select module_id, kind, customer, unit_label, to_place, from_place, happened_at, by_name, note
  from (
    select a.entity_id as module_id, 'assigned' as kind,
           nullif(btrim(split_part(a.detail, ' · ', 1)), '') as customer,
           nullif(btrim(substr(a.detail, length(split_part(a.detail, ' · ', 1)) + 4)), '') as unit_label,
           nullif(btrim(split_part(a.detail, ' · ', 1)), '') as to_place,
           'HQ' as from_place,
           a.created_at as happened_at, a.actor_name as by_name, 'From the activity log' as note
      from activity a
      join modules m on m.id = a.entity_id
     where a.entity_type = 'module' and a.action = 'assigned'
    union all
    select a.entity_id, 'returned',
           nullif(btrim(regexp_replace(coalesce(a.detail, ''), '^.*\mfrom\s+', '')), ''),
           null,
           'HQ',
           nullif(btrim(regexp_replace(coalesce(a.detail, ''), '^.*\mfrom\s+', '')), ''),
           a.created_at, a.actor_name, 'From the activity log'
      from activity a
      join modules m on m.id = a.entity_id
     where a.entity_type = 'module' and a.action = 'returned'
    union all
    select m.id, 'assigned',
           coalesce(m.assigned_customer, m.location),
           m.assigned_unit_label,
           coalesce(m.assigned_customer, m.location),
           'HQ',
           coalesce(m.assigned_at, m.updated_at), m.assigned_by, 'On the account when the trail started'
      from modules m
     where (m.assigned_customer is not null
            or (m.status = 'Installed at Account' and coalesce(btrim(m.location), '') not in ('', 'SHELF', 'shelf')))
       and not exists (select 1 from activity a where a.entity_type = 'module' and a.entity_id = m.id and a.action = 'assigned')
  ) seed
 where not exists (select 1 from module_stops);
