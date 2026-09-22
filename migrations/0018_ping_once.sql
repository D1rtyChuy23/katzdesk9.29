-- One ping per note. Timestamp lives on the comment and on the notification.

alter table comments add column if not exists pinged_at timestamptz;
alter table comments add column if not exists pinged_by text;

alter table desk_notifications add column if not exists comment_id int;

-- Drop extra pings so the unique index can apply on a live database.
delete from desk_notifications
where id in (
  select id from (
    select id,
           row_number() over (partition by user_id, comment_id order by id) as rn
    from desk_notifications
    where comment_id is not null
  ) ranked
  where rn > 1
);

create unique index if not exists desk_notifications_comment_once_idx
  on desk_notifications (user_id, comment_id)
  where comment_id is not null;
