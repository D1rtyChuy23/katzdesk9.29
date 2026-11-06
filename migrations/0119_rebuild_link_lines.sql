-- How many of a rebuild's invoice lines its link put on the ticket's or install's bill (11/6 review). A billed ticket
-- keeps a rebuild whose link put lines there, even when none of them can be told apart any more (the Billing Backfill
-- writes NetSuite's lines without the rebuild's keys); a link that put nothing there can be undone. Rebuilds linked
-- before this put nothing there: 0. Only adds a column. Its own file: 0118 was pushed before this was added.
alter table rebuilds add column if not exists link_lines int not null default 0;
