-- Legacy review of the 30 models in The Library, checked on Oct 12, 2026 against each manufacturer's own site.
--
-- Result: no model in The Library is listed as discontinued or obsolete by its manufacturer, so nothing is moved
-- to Legacy here. Three could not be confirmed either way. They stay in the main row and are flagged
-- Confirm Legacy, with what was found. Nothing is renamed, moved or deleted.
--
-- Sources used:
--   BUNN Product Manuals (manuals.bunn.com): its "Current Models Only" / "Discontinued Models Only" filter.
--     Current there: Axiom 15-3 (38700.0000, 38700.0002), Axiom DV-APS (38700.0010), Axiom DV-TC (38700.0011),
--     Axiom Twin APS (38700.0013), FPG-2 DBC (36400.0000), G9-2T HD (24250.0021), ITB DDIL (52000.0301),
--     ITCB-DV 29" w/tray (52200.0100), Nitron w/RGD & NGM (51600.0028).
--   Eversys product pages (eversys.com/en-us/products/cameo, /enigma, /legacy): Cameo Classic, Enigma E'4s / E'4ms,
--     E'Fridge Classic and ST, Legacy+ L'2c and L'2m are shown.
--   La Marzocco USA commercial products page: Linea Classic S, Linea PB, Strada S, Strada X and Swift are shown.
--   Rancilio Group Classe 5 page: Classe 5 USB is shown, with compact versions.
--   FETCO coffee brewers page and user guides pages.

update library_books
   set confirm_legacy = true,
       legacy_note = 'BUNN''s sales page for 24250.0021 says it may no longer be available for purchase (commercial.bunn.com/24250.0021). BUNN Product Manuals still lists 24250.0021 as a current model (manuals.bunn.com). Checked Oct 12, 2026.'
 where legacy = false and confirm_legacy = false
   and lower(title) = lower('BUNN G9-2T HD Stainless');

update library_books
   set confirm_legacy = true,
       legacy_note = 'Not on FETCO''s current brewer list (fetco.com/coffee-brewers). Its user guide is still under the current Plus Series, not under Legacy Models (fetco.com/user-guides-brewers). Checked Oct 12, 2026.'
 where legacy = false and confirm_legacy = false
   and lower(title) = lower('FETCO CBS-1250 Plus');

-- The apostrophe in e'4 may be straight or curly, so one character is matched loosely.
update library_books
   set confirm_legacy = true,
       legacy_note = 'X-Wide is not shown on Eversys''s Enigma page (eversys.com/en-us/products/enigma), and no discontinued notice was found. Checked Oct 12, 2026.'
 where legacy = false and confirm_legacy = false
   and title ilike 'Eversys Enigma e_4 X-Wide';
