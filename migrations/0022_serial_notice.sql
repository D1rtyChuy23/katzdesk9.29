-- Last warehouse serial-pull notice on installs and service tickets.
alter table installs add column if not exists serial_notice text;
alter table service_jobs add column if not exists serial_notice text;
