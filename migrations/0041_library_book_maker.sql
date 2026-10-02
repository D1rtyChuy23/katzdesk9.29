-- The Library: books are grouped under their manufacturer (Bunn → Axiom, ITCB …).
alter table library_books add column if not exists manufacturer text;
