-- Per-machine answer: does this unit need a counter core for utility lines?
alter table install_inspection_units
  add column if not exists core_needed text;
