-- Whether a rebuild's link was made while the project's bill was open (11/6 review, round 2). Its parts and labor go
-- on that bill from then on, by hand too, without the rebuild's keys; so once the ticket is billed (or the install's
-- invoice approved) the link stays, though none of its lines can be told apart there. A link made before 11/6, or onto
-- a bill already closed, put nothing there through the link: null, and it can be undone. Only adds a column.
alter table rebuilds add column if not exists link_open boolean;
