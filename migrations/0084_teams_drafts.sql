-- Exact Teams notes an admin has approved. KatzDesk does not post them.
-- The Teams login sends only a body that matches one of these rows.
create table if not exists teams_drafts (
  id           serial primary key,
  chat         text not null,
  body         text not null,
  approved_by  text not null,
  approved_at  timestamptz not null default now()
);
create index if not exists teams_drafts_chat_idx on teams_drafts (chat, id desc);
