-- Per-machine serial / power on installs, plus desk account approval.

alter table installs add column if not exists machines text;

create table if not exists desk_accounts (
  user_id    text primary key,
  username   text not null,
  email      text,
  approved   boolean not null default false,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists desk_accounts_username_uidx
  on desk_accounts (lower(username));
