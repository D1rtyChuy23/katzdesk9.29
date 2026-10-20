-- Teams group chats and DMs an admin can add and remove. KatzDesk does not post.
-- feed picks what the note lists; target is the rep, region (dfw | sa-atx | other) or tech it follows.
-- Corey Russell is the delivery dispatcher, not a tech. His id stays dm-cory so his teams_drafts history stays linked.
create table if not exists teams_chats (
  id          text primary key,
  name        text not null,
  grp         text not null,
  kind        text not null check (kind in ('group', 'dm')),
  about       text not null default '',
  feed        text not null check (feed in ('service', 'orders', 'rep', 'region', 'leadership', 'tech', 'dispatch')),
  target      text,
  sort        int not null default 0,
  created_by  text,
  created_at  timestamptz default now()
);

insert into teams_chats (id, name, grp, kind, about, feed, target, sort) values
  ('big-tymers', 'Big Tymers, Big Poppin', 'Service', 'group', 'Main service tracker. What needs attention.', 'service', null, 10),
  ('purchase-orders', 'Purchase Order Requests', 'Orders', 'group', 'Parts and water-filter orders to place in NetSuite.', 'orders', null, 20),
  ('rep-sean', 'Sean''s Customers'' Request', 'Reps', 'group', 'Sean Marshall''s customer service calls.', 'rep', 'Sean Marshall', 30),
  ('rep-shannon', 'Shannon''s Customers'' Request', 'Reps', 'group', 'Shannon Cafourek''s customer service calls.', 'rep', 'Shannon Cafourek', 40),
  ('rep-amanda', 'Amanda''s Customers'' Request', 'Reps', 'group', 'Amanda Logg''s customer service calls.', 'rep', 'Amanda Logg', 50),
  ('rep-liz', 'Liz''s Customers'' Request', 'Reps', 'group', 'Lizbeth Romero''s customer service calls.', 'rep', 'Lizbeth Romero', 60),
  ('rep-chelsea', 'Chelsea''s Customers'' Request', 'Reps', 'group', 'Chelsea''s customer service calls.', 'rep', 'Chelsea', 70),
  ('rep-iliana', 'Iliana''s Customers'' Request', 'Reps', 'group', 'Iliana''s customer service calls.', 'rep', 'Iliana', 80),
  ('dfw', 'DFW Service Chat', 'Regions', 'group', 'Dallas and Fort Worth service with Bill and Shannon.', 'region', 'dfw', 90),
  ('sa-atx', 'SA/ATX', 'Regions', 'group', 'San Antonio and Austin service.', 'region', 'sa-atx', 100),
  ('service-monkeys', 'Service Monkeys', 'Regions', 'group', 'Open calls outside DFW and SA/ATX that still need a tech.', 'region', 'other', 110),
  ('k-team', 'The K Team', 'Leadership', 'group', 'This month''s counts and the parts-profit total.', 'leadership', null, 120),
  ('dm-ryan', 'Ryan Gloria', 'Techs', 'dm', 'Ryan''s open calls.', 'tech', 'Ryan Gloria', 130),
  ('dm-josh', 'Josh', 'Techs', 'dm', 'Josh''s open calls.', 'tech', 'Joshua Harper', 140),
  ('dm-lance', 'Lance Oden', 'Techs', 'dm', 'Lance''s open calls.', 'tech', 'Lance Oden', 150),
  ('dm-oliver', 'Oliver Garcia', 'Techs', 'dm', 'Oliver''s open calls.', 'tech', 'Oliver Garcia', 160),
  ('dm-charles', 'Charles Foster', 'Techs', 'dm', 'Charles''s open calls.', 'tech', 'Charles Foster', 170),
  ('dm-cory', 'Corey Russell', 'Dispatch', 'dm', 'Installs still to deliver, by install date.', 'dispatch', null, 180)
on conflict (id) do nothing;
