-- Named recipes: a customer (or the house) can keep more than one recipe per model,
-- so the equipment row can offer a choice. Unnamed recipes behave exactly as before.

alter table recipes add column if not exists name text;

drop index if exists recipes_house_model_uidx;
drop index if exists recipes_customer_model_uidx;

create unique index if not exists recipes_scope_model_name_uidx
  on recipes (lower(coalesce(customer, '')), lower(equipment_model), lower(coalesce(name, '')));
