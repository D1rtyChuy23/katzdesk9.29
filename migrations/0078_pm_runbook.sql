-- PM runbook. Machine options (steam wands, tea option, E'choco, Americano, 1.5-Step) belong to the unit, not the
-- PM job: a unit moves between the warehouse (assets) and customer accounts (account_equipment) and keeps one
-- history, so options are keyed by the normalised serial (same value as account_equipment.serial_key; assets has
-- no serial_key column, the app computes it from assets.serial). Changes append to the activity log
-- (entity_type 'unit_runbook', entity_id = this row's id).

create table if not exists unit_runbook_options (
  id          serial primary key,
  serial_key  text not null unique,
  runbook_id  text not null,
  options     jsonb not null default '{}',
  updated_by  text,
  updated_at  timestamptz not null default now()
);

-- One row per PM job and unit: which runbook, model and interval the tech chose. unit_key is the serial key when
-- the unit has a serial, else 'piece:<normalised equipment text>#<n>'. options holds the unit's options only
-- when it has no serial to key them by.
create table if not exists pm_runbook_units (
  pm_job_id    int not null references pm_jobs (id) on delete cascade,
  unit_key     text not null,
  runbook_id   text not null,
  model        text,
  interval_mo  text,
  options      jsonb,
  updated_by   text,
  updated_at   timestamptz not null default now(),
  primary key (pm_job_id, unit_key)
);

-- Ticks: key is 'kit:EV117077' or 'step:brew-grease'. A row exists while the box is ticked.
create table if not exists pm_runbook_checks (
  pm_job_id  int not null references pm_jobs (id) on delete cascade,
  unit_key   text not null,
  key        text not null,
  done_by    text,
  done_at    timestamptz not null default now(),
  primary key (pm_job_id, unit_key, key)
);
