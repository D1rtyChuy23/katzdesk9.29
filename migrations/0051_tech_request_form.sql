-- Install board: Sales ticks "Tech Request Form issued" once the form has gone out. It is never ticked for them.
alter table installs add column if not exists trf_issued boolean not null default false;
alter table installs add column if not exists trf_issued_by text;
alter table installs add column if not exists trf_issued_at timestamptz;
