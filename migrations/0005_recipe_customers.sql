-- Customer-scoped recipes (house templates stay customer-null)

alter table recipes drop constraint if exists recipes_equipment_model_key;

alter table recipes add column if not exists customer text;
alter table recipes add column if not exists install_id int;
alter table recipes add column if not exists copied_from int;
alter table recipes add column if not exists is_template boolean not null default false;

update recipes set is_template = true where customer is null;

create index if not exists recipes_customer_idx on recipes (lower(customer));
create index if not exists recipes_install_idx on recipes (install_id);
create index if not exists recipes_model_idx on recipes (lower(equipment_model));

create unique index if not exists recipes_house_model_uidx
  on recipes (lower(equipment_model))
  where customer is null;

create unique index if not exists recipes_customer_model_uidx
  on recipes (lower(customer), lower(equipment_model))
  where customer is not null;
