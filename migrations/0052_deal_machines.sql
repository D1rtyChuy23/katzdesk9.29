-- Every machine on a deal, one row each: model, serial, voltage. Same shape as installs.machines.
alter table deals add column if not exists machines text;
