-- WO part lines (Grok through Chuy, 2026-10-28): the parts a work order used, as Corrigo or NetSuite lists them, loaded
-- by Parts → Import → Import WO Part Lines (CSV) (Admin only). Only Parts usage reads them. They are kept apart from
-- ticket_charges, so a ticket's Charges, and the lock its NetSuite Sales Order puts on them, don't change. Nothing
-- existing changes: the table starts empty.
--
-- A line is on at most one KatzDesk ticket, the one with its WO when the import ran: a service or TLC ticket (job_id),
-- a PM (pm_id) or an install (install_id). On none, it counts on its WO alone. `wo` is the Corrigo form (WO-0855).
-- `sku` is the item after its last colon, in capitals with no spaces (BUNN40670.0005). A blank qty is saved as 1, with
-- qty_blank set.
create table if not exists ticket_part_lines (
  id           serial primary key,
  job_id       int references service_jobs (id) on delete set null,
  pm_id        int references pm_jobs (id) on delete set null,
  install_id   int references installs (id) on delete set null,
  wo           text not null,
  item         text not null,
  sku          text not null,
  qty          numeric(12, 2) not null check (qty > 0),
  qty_blank    boolean not null default false,
  used_on      date not null,
  source       text not null check (source in ('corrigo', 'netsuite')),
  source_ref   text,
  imported_by  text,
  imported_at  timestamptz not null default now(),
  check (num_nonnulls(job_id, pm_id, install_id) <= 1)
);
create unique index if not exists ticket_part_lines_uidx on ticket_part_lines (wo, sku, source);
create index if not exists ticket_part_lines_job_idx on ticket_part_lines (job_id) where job_id is not null;
create index if not exists ticket_part_lines_pm_idx on ticket_part_lines (pm_id) where pm_id is not null;
create index if not exists ticket_part_lines_install_idx on ticket_part_lines (install_id) where install_id is not null;
