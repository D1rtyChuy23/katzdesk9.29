-- A completed deal's link to an install, for an Admin to review (Chuy, 11/3). Asked whether a deal marked complete
-- should link only to an open install: "yes link and mark for review to approve", then "Link now, Admin approves".
--
-- When a deal is marked complete with no install tied to it yet, the account's newest open install with no deal is
-- linked to it (never a finished one), or a new install is made for it. deal_review says which ('linked' or 'made')
-- until an Admin approves the link (null again) or unlinks it. Links made before this change are left as they are.
alter table installs add column if not exists deal_review text;
alter table installs add column if not exists deal_review_at timestamptz;

-- The installs an Admin unlinked from a deal: its next handoff (the Handoff page's button) skips them, so a wrong link
-- isn't made again.
alter table deals add column if not exists unlinked_installs int[] not null default '{}';

-- The handoff that has the deal now: each handoff's claim sets its own token, and its writes go ahead only while the
-- token is still its own, so of two handoffs of one deal at once only one links or makes an install.
alter table deals add column if not exists handoff_claim text;
