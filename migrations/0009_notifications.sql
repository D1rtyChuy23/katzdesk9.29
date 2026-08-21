-- Per-user pings / reminders. Scoped by recipient user_id.

create table if not exists desk_notifications (
  id            serial primary key,
  user_id       text not null,
  from_user_id  text,
  from_name     text,
  body          text not null,
  entity_type   text,
  entity_id     int,
  read          boolean not null default false,
  created_at    timestamptz not null default now()
);
create index if not exists desk_notifications_inbox_idx
  on desk_notifications (user_id, read, created_at desc);
