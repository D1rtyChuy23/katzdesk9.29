-- Pre-inspection checks and photos belong to one account equipment line, not the whole café.

alter table install_inspection_items
  add column if not exists equipment_id int references account_equipment(id) on delete cascade;

alter table install_inspection_photos
  add column if not exists equipment_id int references account_equipment(id) on delete cascade;

alter table install_inspection_items
  drop constraint if exists install_inspection_items_install_id_category_key;

create unique index if not exists install_inspection_items_unit_cat_idx
  on install_inspection_items (install_id, equipment_id, category);

create table if not exists install_inspection_units (
  install_id    int not null references installs(id) on delete cascade,
  equipment_id  int not null references account_equipment(id) on delete cascade,
  primary key (install_id, equipment_id)
);

create index if not exists install_inspection_photos_unit_idx
  on install_inspection_photos (install_id, equipment_id, category);
