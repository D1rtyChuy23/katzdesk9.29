-- Parts by MPN: the manufacturer price a price file brings in, what each approved import changed, and the cost,
-- sell, discount and margin stored on an invoiced part line.

alter table billing_items add column if not exists list_price numeric(12, 2);
alter table billing_items add column if not exists list_price_at timestamptz;

-- One row per approved import. A preview writes nothing, so it leaves no row.
create table if not exists part_import_runs (
  id           serial primary key,
  kind         text not null check (kind in ('parts', 'pricing')),
  filename     text not null,
  target       text,
  row_count    int not null,
  added        int not null default 0,
  updated      int not null default 0,
  not_applied  int not null default 0,
  approved_by  text,
  approved_at  timestamptz not null default now()
);

-- Stored when the ticket is invoiced (its Sales Order number is entered), from the part and Our Discount Rule
-- at that moment, so later price changes do not rewrite what was invoiced.
alter table ticket_charges add column if not exists mpn text;
alter table ticket_charges add column if not exists list_price numeric(12, 2);
alter table ticket_charges add column if not exists unit_cost numeric(12, 2);
alter table ticket_charges add column if not exists cost_source text;
alter table ticket_charges add column if not exists our_discount numeric(12, 2);
alter table ticket_charges add column if not exists ticket_discount numeric(12, 2);
alter table ticket_charges add column if not exists margin numeric(12, 2);
alter table ticket_charges add column if not exists priced_at timestamptz;

create table if not exists desk_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
