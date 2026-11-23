-- Suggested machines for older tickets (Chuy, 11/21: "Suggest, you confirm"). A pair someone marked "Not this one" is
-- kept here so it isn't suggested again. Only adds a table; nothing existing changes.
create table if not exists ticket_unit_dismissals (
  job_id integer not null references service_jobs (id) on delete cascade,
  account_equipment_id integer not null references account_equipment (id) on delete cascade,
  dismissed_by text,
  created_at timestamptz not null default now(),
  primary key (job_id, account_equipment_id)
);
