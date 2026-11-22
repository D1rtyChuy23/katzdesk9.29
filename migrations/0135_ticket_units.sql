-- Ticket-to-machine links (Chuy, 11/21): a service or TLC ticket names any number of its account's units, so each unit
-- has a service history. Optional. Only adds a table and an index; nothing existing changes. A removed unit's links
-- are kept on its retired record (links->'ticket_links') and come back with Put back.
create table if not exists ticket_units (
  job_id integer not null references service_jobs (id) on delete cascade,
  account_equipment_id integer not null references account_equipment (id) on delete cascade,
  linked_by text,
  created_at timestamptz not null default now(),
  primary key (job_id, account_equipment_id)
);

create index if not exists ticket_units_equip_idx on ticket_units (account_equipment_id);
