-- Teams notes (Chuy, 11/2). Purchase Order Requests is now the weekly report of parts and water filters used, by
-- manufacturer. The rep chats add what was serviced on their accounts, the Pipeline and installs. Service Monkeys
-- lists each tech's open calls and the equipment to get ready for installs.
-- Each chat's About changes only where it still reads as seeded, so one an admin edited keeps its words.
-- The five tech DMs are not removed here: Chuy removes them with Remove on the Teams page (deletes on production are
-- his to press). Their approved notes stay in teams_drafts either way.
update teams_chats set about = 'Each week''s parts and water filters used, by manufacturer, to reorder in NetSuite.'
 where id = 'purchase-orders' and about = 'Parts and water-filter orders to place in NetSuite.';

update teams_chats set about = 'Sean Marshall''s accounts: service done, open calls, the Pipeline and installs.'
 where id = 'rep-sean' and about = 'Sean Marshall''s customer service calls.';
update teams_chats set about = 'Shannon Cafourek''s accounts: service done, open calls, the Pipeline and installs.'
 where id = 'rep-shannon' and about = 'Shannon Cafourek''s customer service calls.';
update teams_chats set about = 'Amanda Logg''s accounts: service done, open calls, the Pipeline and installs.'
 where id = 'rep-amanda' and about = 'Amanda Logg''s customer service calls.';
update teams_chats set about = 'Lizbeth Romero''s accounts: service done, open calls, the Pipeline and installs.'
 where id = 'rep-liz' and about = 'Lizbeth Romero''s customer service calls.';
update teams_chats set about = 'Chelsea''s accounts: service done, open calls, the Pipeline and installs.'
 where id = 'rep-chelsea' and about = 'Chelsea''s customer service calls.';
update teams_chats set about = 'Iliana''s accounts: service done, open calls, the Pipeline and installs.'
 where id = 'rep-iliana' and about = 'Iliana''s customer service calls.';

update teams_chats set about = 'Each tech''s open calls, the calls outside DFW and SA/ATX that need a tech, and the equipment to get ready for installs.'
 where id = 'service-monkeys' and about = 'Open calls outside DFW and SA/ATX that still need a tech.';

-- The weekly Purchase Order report as each Friday 5 PM pulled it. The first look at the Teams chats after that time
-- saves the week's pull, so Monday reads exactly what was pulled. `uses` is what this pull reported for each ticket
-- and part ({k: ticket, p: part, q: pieces}, the change since the pulls before it), so the next pull reports only
-- what is new. `report` is the parts the note lists ({maker, sku, label, pieces}). `seq` keeps the pulls in one
-- line: each is worked out against every pull before it, so two can't both be saved as the next one.
create table if not exists teams_po_pulls (
  seq        int not null unique,
  week_to    date primary key,
  week_from  date not null,
  pulled_at  timestamptz not null default now(),
  uses       jsonb not null default '[]'::jsonb,
  report     jsonb not null default '[]'::jsonb
);
