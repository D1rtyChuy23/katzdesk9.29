-- Invites + first-login username choice. Existing accounts already picked a name.

alter table desk_accounts
  add column if not exists username_chosen boolean not null default false;
alter table desk_accounts
  add column if not exists denied boolean not null default false;

update desk_accounts
   set username_chosen = true
 where username_chosen = false
   and username is not null
   and length(trim(username)) >= 3;

create table if not exists desk_invites (
  id               serial primary key,
  email            text,
  username         text,
  invited_by       text not null,
  status           text not null default 'pending',
  accepted_user_id text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists desk_invites_status_idx on desk_invites (status, created_at desc);
create index if not exists desk_invites_email_idx on desk_invites (lower(email));
create index if not exists desk_invites_username_idx on desk_invites (lower(username));
