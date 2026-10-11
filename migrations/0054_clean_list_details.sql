-- Approved clean-list accounts carry the list's ID, ship-to address and sales rep. desk_role may now be 'admin'.
alter table directory_customers add column if not exists address text;
-- Why the rep is blank: no sales rep on the clean list, or a rep who is not on the KatzDesk rep list.
alter table directory_customers add column if not exists rep_flag text;

alter table customer_clean_items add column if not exists address text;
alter table customer_clean_items add column if not exists sales_rep text;
alter table customer_clean_items add column if not exists rep_name text;
alter table customer_clean_items add column if not exists rep_flag text;
