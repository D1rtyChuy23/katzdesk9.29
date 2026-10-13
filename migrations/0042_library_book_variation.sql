-- The Library: one book per model variation (Axiom DV-APS, Axiom Twin …), not one per family.
-- Books that existed before this are split once, on first load, then marked.
alter table library_books add column if not exists per_variation boolean not null default false;
