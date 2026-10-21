-- Sales reps NetSuite has on a customer. The account's one Primary Sales Rep stays in directory_customers.account_rep.
create table if not exists customer_sales_reps (
  id               serial primary key,
  customer_id      int not null references directory_customers (id) on delete cascade,
  rep_name         text not null,
  rep_user_id      text,
  role             text,
  contribution_pct numeric,
  is_primary       boolean not null default false,
  source           text not null default 'netsuite',
  updated_at       timestamptz not null default now()
);
create index if not exists customer_sales_reps_customer_idx on customer_sales_reps (customer_id);
