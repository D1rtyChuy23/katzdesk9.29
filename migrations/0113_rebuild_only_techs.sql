-- Techs on rebuilds only (Chuy, 11/3): "I need to add Pedro Jr. and Pedro Sr. to the tech list. They only populate in
-- the rebuild section. Not for service calls." Asked whether that meant rebuilds only: "Correct. Only rebuilds."
--
-- desk_techs is made by the app the first time the roster is read (ensureRoster in src/lib/ops/roster.ts), with this
-- column. On a database where the app hasn't made it yet, there is nothing to change here.
alter table if exists desk_techs add column if not exists rebuilds_only boolean not null default false;

do $$
begin
  if to_regclass('desk_techs') is null then
    return;
  end if;
  -- Either of them already on the roster, under any spelling ("Pedro Jr", "pedro jr."): on rebuilds only, and active.
  update desk_techs
     set rebuilds_only = true, active = true, updated_at = now()
   where regexp_replace(lower(name), '[^a-z0-9]', '', 'g') in ('pedrojr', 'pedrosr');
  -- Else added, after everyone else on the list.
  insert into desk_techs (name, active, sort_order, rebuilds_only)
  select v.name, true, (select coalesce(max(sort_order), 0) from desk_techs) + v.n * 10, true
    from (values ('Pedro Jr.', 1), ('Pedro Sr.', 2)) as v(name, n)
   where not exists (
     select 1 from desk_techs t
      where regexp_replace(lower(t.name), '[^a-z0-9]', '', 'g') = regexp_replace(lower(v.name), '[^a-z0-9]', '', 'g')
   );
end $$;
