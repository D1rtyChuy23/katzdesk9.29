-- A pre-install visit (Chuy, 11/14): a pre-inspection or site visit Corrigo files like install work is its own
-- service ticket, linked here to the install it was for. The install keeps its status, dates and Corrigo net; its card
-- lists the visit. Only adds a column: every existing ticket starts unlinked.
alter table service_jobs add column if not exists visit_install_id int references installs (id) on delete set null;
create index if not exists service_jobs_visit_install_idx on service_jobs (visit_install_id) where visit_install_id is not null;
