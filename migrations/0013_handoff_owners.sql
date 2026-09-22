-- Note ownership: unsourced names are not real posters.
-- Deal handoff: once sent to installs, stay off the handoff board even if the install is later removed.

alter table deals add column if not exists handed_off boolean not null default false;

update deals d
set handed_off = true
where d.handed_off = false
  and (
    exists (select 1 from installs i where i.deal_id = d.id)
    or (
      d.completion = 'complete'
      and exists (
        select 1 from installs i
        where i.archived = false
          and lower(i.customer) = lower(d.customer)
      )
    )
  );

update comments
set author_name = null
where author_id is null
  and author_name is not null;
