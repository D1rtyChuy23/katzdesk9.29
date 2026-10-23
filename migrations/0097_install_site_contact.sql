-- The install's own site contact and phone, typed on the install's Details tab and printed on the Equipment Request
-- Form. Blank until someone types them; the form then shows the pre-inspection's site contact, as it did before.
alter table installs add column if not exists site_contact text;
alter table installs add column if not exists contact_phone text;
