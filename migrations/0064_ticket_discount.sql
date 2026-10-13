-- Discount on a ticket: one per ticket, Percent or Amount, taken off the charge lines' subtotal.
-- Stored as the choice and its value (never as a discounted total), so it can never be applied twice.
alter table service_jobs add column if not exists discount_kind text;
alter table service_jobs add column if not exists discount_value numeric(12, 2);
alter table service_jobs drop constraint if exists service_jobs_discount_check;
alter table service_jobs add constraint service_jobs_discount_check check (
  (discount_kind is null and discount_value is null)
  or (discount_kind = 'percent' and discount_value > 0 and discount_value <= 100)
  or (discount_kind = 'amount' and discount_value > 0)
);
