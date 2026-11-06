-- The billed ticket a rebuild came to an install with (11/6 review, round 4). A ticket merged into an install as billed
-- keeps its charges, billed, and a rebuild linked while that ticket was open may have parts among them (added by hand,
-- with no rebuild key). That merge sets this to the ticket's id; while it's set, the rebuild stays linked, wherever
-- Merge installs takes it. Null otherwise, and for every rebuild before this. Only adds a column. Its own file: 0118 to
-- 0120 were pushed before this was added.
alter table rebuilds add column if not exists link_billed_with int;
