-- User roles, locked sales-rep list, Avi Katz account flag, ping customer preview.

alter table desk_accounts add column if not exists desk_role text;

create table if not exists desk_reps (
  id serial primary key,
  name text not null,
  initials text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table directory_customers add column if not exists account_rep text;
alter table directory_customers add column if not exists avi_katz boolean not null default false;

alter table desk_notifications add column if not exists customer text;
