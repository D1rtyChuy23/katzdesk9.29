-- A machine's condition as the verified units list gives it (Excellent, Good, Fair, Poor), Chuy 11/12. Only adds a
-- column, on the account's units and on the retired copies: no existing row changes.
alter table account_equipment add column if not exists condition text;
alter table account_equipment_retired add column if not exists condition text;
