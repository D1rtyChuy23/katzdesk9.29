-- Every row of the clean list as read, so any list name can be chosen for an account on the review.
create table if not exists customer_clean_rows (
  id           serial primary key,
  run_id       int not null references customer_clean_runs(id) on delete cascade,
  internal_id  text,
  name         text not null,
  address      text,
  sales_rep    text,
  rep_name     text,
  rep_flag     text
);
create index if not exists customer_clean_rows_run_idx on customer_clean_rows (run_id);
