-- NetSuite customer import. The site address stays in address (NetSuite's shipping address); the billing address is
-- kept separately. Primary contact, phone and email come from NetSuite too. Inactive accounts are hidden from the
-- default customer lists and pickers, never deleted.
alter table directory_customers add column if not exists billing_address1 text;
alter table directory_customers add column if not exists billing_address2 text;
alter table directory_customers add column if not exists billing_city text;
alter table directory_customers add column if not exists billing_state text;
alter table directory_customers add column if not exists billing_zip text;
alter table directory_customers add column if not exists billing_country text;
alter table directory_customers add column if not exists primary_contact text;
alter table directory_customers add column if not exists phone text;
alter table directory_customers add column if not exists email text;
alter table directory_customers add column if not exists inactive boolean not null default false;

-- One line per import that saved: who, when, the file, what the preview counted and what was saved.
create table if not exists customer_import_runs (
  id           serial primary key,
  source       text not null default 'netsuite',
  filename     text,
  row_count    int not null default 0,
  will_create  int not null default 0,
  will_update  int not null default 0,
  no_change    int not null default 0,
  conflict     int not null default 0,
  skipped      int not null default 0,
  excluded     int not null default 0,
  created      int not null default 0,
  updated      int not null default 0,
  created_by   text,
  created_at   timestamptz not null default now()
);
