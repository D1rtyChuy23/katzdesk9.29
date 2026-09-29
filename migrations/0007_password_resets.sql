-- One-time password reset links an admin can hand to a teammate (the desk sends no email).
create table if not exists desk_password_resets (
  id          serial primary key,
  user_id     text not null references "user" ("id") on delete cascade,
  token_hash  text not null unique,
  created_by  text,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists desk_password_resets_user_idx on desk_password_resets (user_id);
