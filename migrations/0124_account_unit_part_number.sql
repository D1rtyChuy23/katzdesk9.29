-- A machine's part number on an account (Chuy, 11/9): typed from its data plate or NetSuite, so two variants of one
-- model can be told apart. Only adds the column: every unit starts blank.
alter table account_equipment add column if not exists part_number text;
