-- The Invoice window, on every customer record. Service and TLC tickets keep their lines and discount where they
-- already are (ticket_charges and service_jobs), so billing, the Charges panel and Parts Profit read the same
-- thing. Every other record (PM, install, rebuild, deal) keeps its lines here. Either way, an invoice is only
-- written when it is approved; Cancel writes nothing.

create table if not exists invoices (
  id              serial primary key,
  entity_type     text not null check (entity_type in ('service', 'tlc', 'pm', 'install', 'rebuild', 'deal')),
  entity_id       int not null,
  customer        text,
  -- Ticket invoices keep their discount on the ticket; these are for the other records.
  discount_kind   text,
  discount_value  numeric(12, 2),
  -- Billing info as it read from the account when the invoice was approved.
  bill_name       text,
  bill_account    text,
  bill_address    text,
  bill_rep        text,
  total           numeric(12, 2),
  approved_by     text,
  approved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint invoices_discount_check check (
    (discount_kind is null and discount_value is null)
    or (discount_kind = 'percent' and discount_value > 0 and discount_value <= 100)
    or (discount_kind = 'amount' and discount_value > 0)
  )
);
create unique index if not exists invoices_entity_key on invoices (entity_type, entity_id);

create table if not exists invoice_lines (
  id          serial primary key,
  invoice_id  int not null references invoices (id) on delete cascade,
  item        text not null,
  description text,
  qty         numeric(10, 2) not null check (qty > 0),
  rate        numeric(12, 2) not null check (rate >= 0),
  kind        text not null default 'part',
  sort        int not null default 0
);
create index if not exists invoice_lines_invoice_idx on invoice_lines (invoice_id, sort, id);
