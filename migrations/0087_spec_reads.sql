-- Spec reading queue. A stored spec sheet is read into a review row. Nothing is written
-- onto the model until someone approves it.
create table if not exists spec_reads (
  file_id integer primary key references library_files (id) on delete cascade,
  book_id integer references library_books (id) on delete set null,
  status text not null check (status in ('queued', 'needs_review', 'read', 'unreadable')),
  extracted jsonb,
  changes jsonb,
  error text,
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists spec_reads_status_idx on spec_reads (status, book_id);

-- Which Library Admin sections this person left open. Missing row = default (open when there is work).
create table if not exists library_admin_open (
  user_id text not null,
  section text not null,
  open boolean not null,
  primary key (user_id, section)
);

-- Rows already handled, so they can sit under Resolved instead of the open list.
create table if not exists library_admin_done (
  section text not null,
  item_key text not null,
  label text not null,
  detail text,
  resolved_at timestamptz not null default now(),
  primary key (section, item_key)
);
