-- Wrong passwords are counted per account (11/17): 8 tries in 15 minutes, then that account waits out the window.
-- Per account, not per address: the site sits behind a proxy, so every visitor shares one address.
-- One row per account that has a count running; a good sign-in or a new password removes it.
create table if not exists desk_sign_in_tries (
  user_id      text primary key references "user" ("id") on delete cascade,
  tries        integer not null default 0,
  window_start timestamptz not null default now()
);
