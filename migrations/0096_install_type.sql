-- Install type, picked on the install's Details tab: "new" (a new account) or "update" (an account Katz already serves).
-- Blank until someone picks one; the Equipment Request Form then shows what the account's history suggests.
alter table installs add column if not exists install_type text;
alter table installs drop constraint if exists installs_install_type_check;
alter table installs add constraint installs_install_type_check check (install_type is null or install_type in ('new', 'update'));
