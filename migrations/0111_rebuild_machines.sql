-- Rebuild machines (Chuy, 11/2). Warehouse refurbishes several machines on one rebuild, each with its own serial,
-- or just one. Each machine can pull its warehouse unit onto the refurb, the way the rebuild's one serial did. When a
-- refurb (for Katz Coffee Service Dept. or Katz shop / stock) is completed, each machine goes into stock at the Staging
-- area, marked as needing a shop test, with no Admin review.
create table if not exists rebuild_machines (
  id          serial primary key,
  rebuild_id  int not null references rebuilds (id) on delete cascade,
  model       text not null default '',
  serial      text,
  -- The warehouse unit pulled onto the refurb for it, or the one that went into stock for it.
  asset_id    int,
  -- Where its unit came from, or why none was pulled.
  notice      text,
  -- The unit before the pull (its status, account, purpose, install, ticket and lock), so taking the machine off the
  -- rebuild puts the unit back as it was. Blank for a machine kept from before this table.
  origin      jsonb,
  -- When completing the refurb put it in stock.
  stocked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists rebuild_machines_rebuild_idx on rebuild_machines (rebuild_id, id);
create index if not exists rebuild_machines_asset_idx on rebuild_machines (asset_id) where asset_id is not null;

-- Each rebuild's equipment and serial so far become its first machine.
insert into rebuild_machines (rebuild_id, model, serial, asset_id, notice)
select r.id, coalesce(btrim(r.equipment), ''), nullif(btrim(coalesce(r.serial, '')), ''), r.asset_id, r.serial_notice
  from rebuilds r
 where (btrim(coalesce(r.equipment, '')) <> '' or btrim(coalesce(r.serial, '')) <> '')
   and not exists (select 1 from rebuild_machines m where m.rebuild_id = r.id)
 order by r.id;
