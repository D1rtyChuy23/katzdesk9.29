-- Map location on a customer, from the US Census geocoder (Customers → Import → Locations).
-- geocode_match is 'exact' or 'close' (the Census "Non_Exact"); geocode_address is the address the geocoder matched.
-- The account's own address is never changed by this.
alter table directory_customers add column if not exists latitude double precision;
alter table directory_customers add column if not exists longitude double precision;
alter table directory_customers add column if not exists geocode_match text;
alter table directory_customers add column if not exists geocode_address text;
alter table directory_customers add column if not exists geocoded_at timestamptz;
