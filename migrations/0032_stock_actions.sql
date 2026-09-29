-- Warehouse remove / assign-to-customer. The asset row stays. This table is the history.

create table if not exists asset_stock_actions (
  id            serial primary key,
  asset_id      int not null,
  kind          text not null check (kind in ('remove', 'assign')),
  status        text not null check (status in ('pending', 'approved', 'rejected')),
  reason        text,
  note          text,
  customer      text,
  place_site    text,
  serial        text,
  model         text,
  last_slot     text,
  last_site     text,
  last_pallet   text,
  last_level    int,
  last_line     int,
  asked_by      text not null,
  asked_name    text,
  asked_at      timestamptz not null default now(),
  decided_by    text,
  decided_name  text,
  decided_at    timestamptz
);

create index if not exists asset_stock_actions_asset_idx on asset_stock_actions (asset_id, status);

alter table assets add column if not exists stock_hold text;
alter table assets add column if not exists stock_hold_customer text;
alter table assets add column if not exists stock_hold_reason text;
alter table assets add column if not exists stock_hold_note text;
alter table assets add column if not exists stock_hold_by text;
