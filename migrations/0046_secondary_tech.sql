-- Tickets and TLC: a second service tech can be assigned alongside the primary one.
alter table service_jobs add column if not exists technician2 text;
