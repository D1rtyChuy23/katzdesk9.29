# KatzDesk Cleanup Plan

Phase 1 output. Read-only audit of `main` at `05afd25` (latest migration `0042_library_book_variation.sql`).
No app code was changed to write this. Phase 2 implements the "Plan" section in the order written, one area per commit.

How each finding was checked is stated on the finding:

- **Seen** — reproduced in the running app (local preview, seed data, admin login).
- **Read** — found by reading the code; not reproduced.
- **Not checked** — could not be checked here; the reason is given.

The local preview has seed data only. It has no rack stock on the Front or Back rack and none of the real spec sheets,
so anything that depends on real stock or real PDFs is marked.

Baseline before any Phase 2 change: all 18 routes load with a heading and no page errors; `npm run typecheck`, `npm run lint`
and `npx vite build` pass; `npm test` has 156 passing and 9 failing (the 9 are the Grok share-card tests, failing before this work).

---

## 1. Route Map

| Route | What the user does | Mounts (src/components/desk) | Rule owner (src/lib/ops) |
| --- | --- | --- | --- |
| `/` index | Sees today's clock: what is coming due, flagged, and rebuild alerts. | coming-due, rebuild-alerts, flag-badge, my-view-bar, open-link, ping-button, sort-bar | clock.ts (due/aging), api.ts (dashboard) |
| `/service` | Works the service ticket list and opens a ticket. | jobs-page → job-sheet, thread | ticket-status.ts, api.ts |
| `/tlc` | Works TLC + Factor jobs; same screen as service with a different kind. | jobs-page → job-sheet, thread | ticket-status.ts, api.ts |
| `/pms` | Tracks preventative maintenance dates and opens a PM. | entity-sheets (PM sheet), desk-charts, export-dialog, tech-select, my-view-bar | clock.ts, ticket-status.ts, my-view.ts |
| `/planner` | Sees pending work on a month calendar and drags a job to another day. | planner-calendar, pending-calendar, install-planner, desk-charts | api.ts, equipment.ts |
| `/handoff` | Reads and replies to the sales ↔ service conversation. | handoff-reply, ping-button, open-link, sort-bar | api.ts, lookups.ts, mentions.ts |
| `/installs` | Preps installs: equipment, pre-inspection, recipes, mark installed. | entity-sheets (install sheet), machine-fields, pre-inspection-panel, recipe-sheet, recipe-form, directory-fields, export-dialog | machines.ts, equipment.ts, pre-inspection.ts, inspection-api.ts, clock.ts |
| `/recipes` | Edits house and customer recipe templates. | recipe-form | equipment.ts (findRecipeFor), recipe-fields.ts, api.ts |
| `/pipeline` | Moves equipment deals through Good To Order → Ordered. | entity-sheets (deal sheet), rep-deals-panel, rep-select, desk-charts | rep-match.ts, reps.ts, clock.ts |
| `/library` | Picks a manufacturer, then a model, and opens or sends its spec, manuals and parts. | library-files, spec-sheet, spec-import, image-lightbox | library-file-rules.ts, library-files.ts, spec-library.ts, spec-defaults.ts, spec-image-pick.ts |
| `/warehouse` | Sees rack stock by bay and level, adds, moves and tests units. | asset-sheet, multi-move, stock-actions, unit-place-field, desk-charts | warehouse.ts, rack-stock.ts, unit-place.ts, unit-place-rules.ts |
| `/rebuilds` | Runs in-house rebuild projects on a board. | rebuild-board, rebuild-planner, rebuild-sheet, owner-select | rebuild-model.ts, rebuilds.ts |
| `/locations` | Sees units that are at a site, not on a rack, and moves them. | asset-sheet, stock-actions, unit-place-field, directory-fields | unit-place.ts, unit-place-rules.ts, warehouse.ts |
| `/modules` | Tracks Eversys modules: at HQ, or assigned to a unit on an account. | module-assign, entity-sheets (module sheet), export-dialog | eversys.ts, api.ts |
| `/customers` | Searches accounts and opens one to see every record on it. | customer-sheet, account-equip-import, rename-dialog, rep-select, show-more | customer-identity.ts, account-equip.ts, api.ts |
| `/network` | Manages third-party service companies and dispatches them. | provider-sheet, provider-dispatch, rename-dialog | network.ts, network-api.ts |
| `/settings` | Sets display preferences, reps, roster, and password. | prefs-provider, reps-editor, roster-editor, theme-toggle | prefs.ts, password-reset.ts |
| `/access` | Admin approves accounts and sets roles. | sort-bar | access.ts, password-reset.ts |

Shared by every route: `shell.tsx` (side menu, banner, single Katz Desk wordmark), `search.tsx` (banner search),
`notify-bell.tsx` (pings), `src/components/ui/dialog.tsx`, `sheet.tsx`, `anchored-list.tsx`, `combo-field.tsx`.

---

## 2. Findings

### F1. Install bubble repeats the same equipment, serial and location — **Seen**

Opened the install sheet for a three-machine install ("Coco Crepes Bellaire"). In one bubble, top to bottom:

1. **Pre-inspection "Which Machine?"** lists machines, each with a "No serial · Electrical missing" line.
2. **Warehouse Units** lists units pulled from the rack (model · serial · slot).
3. **Equipment** chips list the models again.
4. **One block per model** with its own Serial, Voltage, Location/Rack picker and Recipe.

So the model name appears in four places, serial in three (inspection line, warehouse unit, model block), and
location in two (warehouse unit slot, model block Location/Rack).

Files: `entity-sheets.tsx` (InstallSheet, InstallAssets), `machine-fields.tsx`, `pre-inspection-panel.tsx`.

### F2. Pre-inspection does not split the machines the way the install does — **Seen**

Same install: the Equipment section shows three machines, but Pre-inspection shows "0/2 machines" and both entries
are named with the whole string `La Marzocco Linea Classic S 2 Group AV/ La Marzocco Swift Dual-Hopper Espresso Grinder/ Bunn Axiom-APS`.
The install list row shows "0/1" for the same install. Three different machine counts for one install.

Files: `inspection-api.ts` (how inspection machines are created from the install), `machines.ts` / `equipment.ts` (the splitter the install uses).
This touches how inspection rows are created, which is close to the pass/fail rules. See Open Questions Q1.

### F3. Recipes are on the equipment row, and also in two other places — **Seen / Read**

The recipe picker is already on each model block in the install sheet (`machine-fields.tsx`). **Seen.**
The install list row also has a recipe chip per model that opens a separate editor (`RecipeChip`, `RecipeEditorSheet` in `installs.tsx`), and `/recipes` edits templates. **Read.**
So a recipe for one machine can be set from the row chip or from the model block.

Also seen: the recipe list on a La Marzocco block offers "Standard · Bunn Axiom-APS", "Standard · Eversys Cameo…", "Standard · Fetco 2051e" — house templates are not filtered to the model. See Q2.

### F4. Library variations — **done in 0042; one leftover to confirm**

Each spec sheet's full model name is its own selection, and clicking one shows only its documents. Checked with two stand-in Axiom variations. **Seen.**
Not checked: the one-time split of an existing book that holds several spec sheets (the local data had only single-sheet books).
Files left in an old family book after the split stay under a plain "Axiom" selection until moved by hand — by design, so nothing is guessed.

### F5. Spec machine photo and dimension diagram — **done; real PDFs not checked**

The photo picker rejects warning symbols, logos, barcodes and line drawings, saves the photo, and it survives a refresh. The dimension drawing is only ever the secondary image. **Seen with stand-in PDFs.**
`EquipmentImage` in `spec-sheet.tsx` has no fallback to the dimension image. **Read.**
Not checked: the real brewer sheet that showed the warning triangle (not available here).

### F6. Plug rules — **Read; match the stated rules**

`decidePlug` in `spec-defaults.ts`:
- 3-phase → Hardwire only. ✔
- 220V 4-wire → L14-20 (≤20A or amps unknown), L14-30 (≤30A). Bunn Axiom at 220V is a 4-wire model exception → L14-20. ✔
- 220V 3-wire → L6-20 / L6-30. ✔
- 220V with no wire count → plug left unset with "Wire count missing". ✔

No other file decides a plug. Install machines carry a free-text Voltage field only (`machine-fields.tsx`); nothing derives a plug from it.
Two things the stated rules do not cover are already coded: 4-wire above 30A → `NEMA 14-50`, 3-wire above 30A → `NEMA 6-50`. See Q3.

### F7. Banner search list slides behind the banner — **Seen**

Typed in the banner search, then scrolled with the list open. The list is positioned in page coordinates, so it moved up
with the page (its top went from 57px to −335px) and the sticky banner covered it.
File: `src/components/ui/anchored-list.tsx` (`placeNode` sets `position: absolute` and `z-index: 1`); the banner is `z-20`.

The "Add another…" equipment list inside the install sheet painted on top correctly when opened. **Seen.**
Not checked: the same list after scrolling inside the sheet, and the other users of the shared list (`combo-field.tsx`, `mention-field.tsx`).

### F8. Center bubbles and scroll — **Read; not reproduced**

`dialog.tsx` locks the page and gives the bubble its own scroll area (`data-dialog-scroll`, `max-height: calc(100dvh − 5.75rem)`).
Dialogs that open from inside another dialog or sheet (rename, delete confirm, book picker, lightbox) each add their own page lock.
I did not reproduce a locked scroll. The automated check I wrote looked for the wrong element, so this is **unverified**, not passed.

### F9. Hover lifts the whole row — **Read**

`styles.css` lifts every button, link and `.desk-lift` element on hover unless it contains another control.
Eight places make an entire row or card one big button, so the whole row lifts:
`jobs-page.tsx` (ticket row), `pms.tsx` (PM row), `customers.tsx` (account row), `network.tsx` (company row),
`modules.tsx` (module row), `customer-sheet.tsx` (record row), `coming-due.tsx` (due row), `rebuild-board.tsx` (board card),
plus `desk-charts.tsx` (stat tile) and `spec-library.tsx` (now unused).
Rows that contain smaller controls do not lift; only those controls do.

### F10. Pings and the record they name — **Read; two gaps**

`notify-bell.tsx` opens `/<route>?open=<id>` for tickets, PMs, installs, deals, rebuilds, modules, customers, and the handoff comment.
Every one of those routes reads `?open=`. Gaps found by reading:

- **Unit pings** (`asset`) always go to `/warehouse`. That screen only knows units on a rack. A unit that has since moved to a site is on `/locations`, so the ping lands on Warehouse and nothing opens.
- **Record not in the loaded list.** Installs, PMs, deals, modules and rebuilds find the record in the list already on screen. If the record is deleted or not in that list, the page loads and nothing opens, with no message.

Not checked: clicking a real ping of each kind end to end.

### F11. Pre-inspection photos — **done**

Photos enlarge on click or tap and can be downloaded from the enlarged view and from the thumbnail. **Seen** for Power, desktop and phone size. Water, Drain, Ethernet and Space use the same tile.

### F12. Warehouse — **Read; local data has no rack stock**

- **One unit per section:** not the case in code. A section (rack + bay + level) holds up to 12 units (`rack-stock.ts` `nextLine`, `LINES` 1–12); the board says "up to 12".
- **Front rack ↔ Back rack:** the place picker is rack → bay → level and the server accepts either rack (`unit-place-field.tsx`, `unit-place.ts`). Multi-move takes a rack as the destination.
- **Mismatch found:** the picker and the server accept bays **A–P on both racks**, but the Warehouse board draws the Front rack with bays **I–P only** (`FRONT_PALLETS` in `warehouse.ts`, used by `warehouse.tsx` and `api.ts`). A unit placed on Front · A through Front · H is saved but has no cell on the board. Capacity counts assume Front = 8 bays. See Q4.

None of this was exercised in the browser: the local preview has no units on a rack.

### F13. Modules at HQ vs assigned — **Read; done in an earlier change**

`modules.tsx` fades assigned rows (55% opacity, muted background) and shows the unit and account they are on; filters are Available / Assigned / All; HQ rows show "At HQ" or the shelf.
Not re-checked in the browser in this pass.

### Seen while auditing, not on the list (no change planned)

- Install Clock shows "Ready 0" at the top while one row carries a green "Ready" badge. The top count means "equipment ready **and** pre-inspection passed"; the row badge appears to mean equipment only.
- The repository is public and contains customer and service data files.

---

## 3. Plan (Phase 2 order)

One area per commit. After each: the screen loads, typecheck, lint, build, and tests at the same 9 known failures.

1. **Banner search list (F7).** Keep the list pinned under its search box while the page or its container scrolls, and above the banner. Check `combo-field` and `mention-field` the same way, inside a sheet and after scrolling.
2. **Center bubble scroll (F8).** First reproduce on desktop and phone: long bubble, bubble opened from a sheet, lightbox over a bubble. Fix only what reproduces. If nothing reproduces, record that and change nothing.
3. **Hover lift (F9).** Whole-row and whole-card buttons get the background highlight only; lift stays on small controls. CSS-only; no layout or colour change.
4. **Pings (F10).** Unit pings open on Warehouse or Locations, whichever holds the unit now. When a record cannot be found, say so in a toast. Click one ping of each kind.
5. **Install bubble duplicates (F1).** Show each machine once: model, serial, voltage, location, recipe on its own block. Warehouse Units and the inspection list refer to that block instead of repeating serial and location. No field is removed from the data. Depends on Q1 for the inspection list.
6. **Recipes on the equipment row (F3).** Keep the picker on the model block as the one place to set a machine's recipe; the list-row chip becomes a read-only label that opens the block. `/recipes` stays as the template editor. Model filtering only if Q2 is answered.
7. **Warehouse Front rack bays (F12).** Only after Q4. Then test Front → Back and Back → Front moves, and a section holding more than one unit, with real or seeded rack stock.
8. **Library leftovers (F4).** Seed a book with two spec sheets and confirm the split; no code change expected.
9. **Modules (F13) and Spec image (F5).** Re-check in the browser; no code change expected.
10. **Titles.** Confirm every page title is Title Case and the Katz Desk wordmark appears once. All 18 headings were Title Case in this pass.

Not planned: plug rules (F6) and pre-inspection photos (F11) already match.

---

## 4. Open Questions (fields stay unchanged until answered)

- **Q1 — Pre-inspection machines.** Should an install with three pieces of equipment have three inspection machines, one per piece? Existing inspections with photos and pass/fail on a combined machine would need a rule for where those go. Until answered, inspection rows are not changed; only the display in item 5.
- **Q2 — Recipe list.** Should a machine only offer templates for its own model, plus that customer's recipes?
- **Q3 — Plugs above 30A.** 220V 4-wire above 30A is coded as NEMA 14-50 and 3-wire above 30A as NEMA 6-50. Keep, or leave unset for the electrician?
- **Q4 — Front rack bays.** Is the Front rack physically bays I–P (8 bays), or A–P like the Back rack? If I–P, the picker should stop offering A–H on Front. If A–P, the board and the capacity count need the other 8 bays.

---

## 5. Phase 2 Result

Answers received: Q1 yes, Q2 yes, Q3 yes, Q4 yes. Q3 was read as "keep" (no change either way).
Q4 was an either/or question, so "yes" does not settle it; item 7 was **not** done.

After the last commit: all 18 routes load with their heading and no page errors; typecheck, lint and build pass; tests are 156 passing, 9 failing (the same 9 as before).

### Corrections to the Phase 1 findings

Two findings in section 2 were wrong. They are left above as written and corrected here.

- **F7 (search list behind the banner) — withdrawn.** The Phase 1 check measured the list's inner content, which scrolls inside the list. Measuring the list box itself: it stays pinned under the search box and on top while the page scrolls. No change made.
- **F10 (ping gaps) — mostly wrong.** Pings already resolve on the server (`notify.ts`): a unit opens in Warehouse or Locations by where it is now, and a removed record falls back to the account with a message. The same rule was missing from the banner **search**, which is what was fixed.

### What was done, in plan order

| # | Area | Result | Commit |
| --- | --- | --- | --- |
| 1 | Banner search list | No change. Not a bug (see correction). | — |
| 2 | Center bubble scroll | No change. Could not reproduce: a bubble taller than the screen scrolled, the side sheet scrolled, and the page scrolled again after closing, at desktop and phone width. Mouse wheel only; touch drag was not tested. | — |
| 3 | Hover lift | Whole rows and cards highlight instead of lifting; small controls still lift. Checked on a ticket row. | `b9e497c` |
| 4 | Pings / search | Search: a unit off the rack opens in Locations. Pings were already correct. Not done: a "not found" message when a stale link names a record that is gone. | `45374f5` |
| 5a | Pre-inspection machines (Q1) | One inspection machine per piece of equipment, split the same way as the install. The test install went from "0/2" with combined names to three named machines. Existing checks, notes and photos stay on the machine they were saved to; an old combined machine with none is taken off that install's inspection. Pass/fail rules untouched. | `9d123fc` |
| 5b | Install bubble duplicates | The Equipment chips above the machine blocks are gone; the add box stays and each block has its own remove button. Left as is: the inspection list's serial line and the Warehouse Units list (see below). | `9825ff2` |
| 6 | Recipes (Q2) | House templates are limited to the machine's model; the customer's own recipes are still offered; a recipe already picked stays listed. The row chip now opens the install instead of a second editor. | `9825ff2`, `24b0bfe` |
| 7 | Warehouse Front rack bays | **Not done — Q4 unanswered.** | — |
| 8 | Library split | Seeded an old-style family book holding two spec sheets and a manual; on load each sheet went to its own model and the manual followed its name. No code change. | — |
| 9 | Modules, spec image | Modules: Available (HQ) / Assigned / All filters present. Assigned-row fading was not looked at in this pass. Spec image: not re-run; unchanged since it was built. | — |
| 10 | Titles | All 18 headings are Title Case. One Katz Desk wordmark shows at a time (side menu on desktop, banner on phone). | — |

### Left unchanged on purpose

- **Warehouse Units and the inspection serial line on the install sheet.** Serial still appears there as well as on the machine block. Removing either changes how a unit is pulled or picked, which is a workflow rule, not a display one.
- **Recipe matching is by exact model name.** A template saved under a slightly different spelling of the model will no longer be offered on that machine.

---

## 6. Follow-Up: Front Rack Bays And Locked Units

Answers received: the Front rack is bays **I–P**. A unit assigned to an account is **locked**: it is an asset at that site or customer.

### Front rack bays (plan item 7) — done

- Every bay picker now offers I–P on the Front rack and A–P on the Back rack: the shared place picker, Return To Barn on a unit, and Add To Rack.
- The server refuses a Front rack bay A–H on every path that places a unit (`rackBayError` in `warehouse.ts`).
- Checked against the running app: adding to Front · A is refused; a unit moved Front · K → Back · B, was refused Back → Front · C, and moved Back → Front · K; a section held 9 units.
- Not changed: any unit already saved on Front · A–H keeps its label but still has no cell on the Front board. None exist in the local data; production was not looked at.

### Locked when assigned — done

- Found: `assignAssetToInstall` let a unit that was already assigned to one account be assigned to another install. The other paths (service, serial pull, place moves) already refused. It now refuses with "already assigned to <account>. Return it to the barn before assigning it again."
- Where a unit's Location is shown, an assigned or sold unit now shows its account with a lock and no picker, instead of a picker that failed on save.
- Returning a unit (Return To Warehouse on the unit, or removing it from the install) still unlocks it. Mark Sold is unchanged.
- Left as is: Rebuilds can reuse a serial assigned elsewhere after an explicit "confirm reuse". That is an existing, deliberate rule.

After this change: all 18 routes load; typecheck, lint and build pass; tests are 156 passing, 9 failing (the same 9).

## 7. Phase 3 Result

Checked in the running app at 1440px and 390px (Playwright, real touch drag for scroll), with a second test teammate so pings could be sent to the test admin.

### Fixed

- **Result lists stranded over a field.** `AnchoredList` only moved on scroll or resize. Picking a machine adds a chip that moves the input, so the equipment list stayed over the field. It now follows its input every frame while open. This is the shared list behind every search and picker, so it applies on every page and in every bubble.
- **New Install bubble.** Equipment was shown twice (chips and rows) and the rows stayed hidden until a customer was picked. Now one compact row per unit (model, serial, voltage, location, recipe, choose or add recipe on that row), shown as soon as a machine is added, with a remove on each row. The customer is picked once and never asked again. The existing-install sheet already had this layout.
- **Row alignment.** Rows are two columns on a phone and one line at 1024px and up. Rack, Bay and Level name themselves in the list instead of repeating captions. Serial uses the same small label as the other fields.
- **Pre-inspection core hole.** The "Primarily needed when utility lines are below the counter." note now shows under the core hole question on the walk, as well as on the spec sheet, the import and the copied configuration.
- **Settings.** The appearance preview card repeated the "Katz Desk" wordmark; it now says "Preview", so each page has one wordmark.

### Verified, no change needed

- Install bubble: "Who changed this" is collapsed; the bubble scrolls by wheel and by touch without moving the page; equipment saved on the bubble shows on that account's pre-inspection (3 machines, serial and electrical carried over).
- Pre-inspection: Add Photo offers Camera and Choose from library (desktop and 390px).
- Spec plug: volts, wire count and model are read first. Axiom 220V 4-wire gives L14-20. A missing wire count leaves Plug unset with "Wire count missing". `spec-defaults.test.mjs` passes 16/16.
- Warehouse: moves go rack, bay, level; Front and Back both work; Front A–H and a missing level are refused; three units were held in one Front section (J, level 2) and the board shows sections holding several serials. Assigned modules show at 55% while available HQ modules are full contrast.
- Pings: the bell has Unread / Read / All with counts. Every type was clicked and lands on its record: ticket, PM, install, deal, rebuild, module, warehouse unit (on a rack), location unit (out at a site), customer, handoff. A ping whose record was removed opens the account with a note. If nothing is left to open (a removed ticket with no account), it says so and stays put. The list refreshes every 8 seconds, so a record removed in the last few seconds can still open once.
- Search lists: the global search list renders on top of the page and banner on all 18 routes at both widths.
- All 18 routes load with a heading and one wordmark and no horizontal overflow. The only console errors are blocked outside hosts in the test sandbox.

### Left as is

- Serial still appears in Warehouse Units and in the inspection list.
- Rebuild "confirm reuse" is unchanged.
- Plug coding above 30A (14-50 / 6-50) is untouched.
- Units saved on Front A–H: none in the local data. Production was not looked at. Any found are to be listed here and not moved silently.
- Hover was spot-checked, not exhaustively re-audited on every page.

Gates: lint 0 errors, typecheck and build pass; tests 156 passing, 9 failing (the same 9 Grok share-card failures).

## 8. Manual Types, Menus, Wire Labels, Replace-Existing, Day Board

Checked in the running app at 1280px and at 390px (touch drag on the phone width).

### Changed

- **Library manuals.** A file added under Manuals is named by its type: Parts Diagram, Operating / Installation Manual, Cleaning Manual, Programming Manual or User Manual. An obvious file name decides; otherwise the list is shown and nothing is filed until one is picked (the server refuses a manual with no type). Files are named `<Book> - <Type>`, where the book is maker + model, for example `Bunn Axiom-DV-APS - Cleaning Manual`. A Parts Diagram is filed on the Parts shelf. One book per variation is unchanged. In Manage, a tag button sets the type on a manual stored before this. New column `library_files.doc_type` (migration 0043).
- **Second menus.** `ActionMenu` (Import / Export on Tickets and TLC, Export on Installs and PMs) closes on select, on a click outside and on Escape, and stays closed when the import or export finishes. It was a `<details>` that never closed.
- **Wire field.** The options read "3-wire — 2 hots, ground" and "4-wire — 2 hots, neutral, ground". L6 / L14 stay on the Plug field. Plug rules are untouched.
- **Pre-inspection.** Each unit is New Install (default) or Replacing Existing Equipment. Replacing asks whether the site requirements are the same: same → pick the existing unit on that account and its pass/fail, notes, photos, core hole answer and check are copied, with the hole size taken from the replaced model; any item can still be changed. Different → the normal one-machine form. Pass/fail rules are unchanged. New columns on `install_inspection_units` (migration 0045).
- **Planner day board.** New Day tab: tech rows, hour columns 7a–9p plus No Time, blocks colored by type with the account name. Drag to another time (hour or half past) or another tech; the drop saves date, time and tech in one write. Day / Week toggle, previous / next / Today, click opens the record. Completed and cancelled work shows dimmed with a lock and does not drag; the server refuses it too. New column `sched_time` on `service_jobs`, `pm_jobs`, `installs` (migration 0044).

### Left as is, on purpose

- Manuals stored before this keep the name "Manual" until someone sets the type in Manage.
- A file dropped straight on Parts Diagram is still named "Parts Book"; one typed as Parts Diagram from Manuals is named "Parts Diagram". Both sit on the Parts shelf.
- The Plug note still reads "Wire count missing — confirm 3-wire L6 or 4-wire L14." That is the Plug field, not the wire field.
- Blocks are one hour wide: tickets, PMs and installs have no duration field.
- The month calendar and the Pending Calendar window are unchanged; they do not show the time of day.
- "Equipment already on the account" is only skipped through the Replacing choice. No unit is skipped automatically.

Gates: lint 0 errors, typecheck and build pass; tests 165 passing, 9 failing (the same 9 Grok share-card failures). All 18 routes load.

## 9. Manual Type List

- The manual types are now: Operating / Installation Manual, Cleaning Manual, Programming Manual, User Manual, Service And Repair Manual.
- Parts Diagram is no longer a manual type. Parts files go only in the Parts Diagram drop zone. A file dropped on Manuals is never filed on the Parts shelf; a parts-sounding name there shows the list instead of guessing. This replaces the Parts Diagram lines in section 8.
- The type button in Manage shows on manuals only.

Checked in the running app: the picker shows the five types with no Parts Diagram, nothing is filed while it waits, and "Service And Repair Manual" files as `<Book> - Service And Repair Manual`. Gates as before.

## 10. Library Families, First-Word Filing, Grinder Specs, Secondary Tech

Checked in the running app at 1280px and 390px.

### Changed

- **Library pathway.** Manufacturer tile, then a Family row (one chip per family: Axiom, FPG, G9, ITCB, Nitron), then that family's variations only. The title reads `<Maker> · <Family>`. A family is the model's first word, up to the first dash or space. Selecting a variation still lists only that variation's spec, manuals and parts. Chip labels are unchanged. No data moved: a family is worked out from the model name.
- **Filing by the first word.** The first word of a document's file name is its model variation (a leading maker name is skipped). The same name files under that chip, whichever model is open. A different name asks once, then makes a new chip; it is never merged into a nearby model. If an existing chip's whole name opens the file name ("G9-2T HD Stainless spec.pdf"), that chip wins. A first word that is not a model (a part number, a date, "Manual") files as before: into the open model, else the picker.
- **Grinders.** `isGrinder`: G9 / G9-2T, Mazzer, Mahlkonig, Ditting, Baratza, EK43, or a category that says grinder. Water And Drain is hidden on the spec sheet, the edit form and the copied configuration; the 3/8" inlet default is not filled in and is removed where it was only ever the default. Power, plug and size are unchanged. Stored water or drain values are hidden, not deleted.
- **Secondary tech.** Tickets and TLC have a Secondary Tech field (`service_jobs.technician2`, migration 0046). It shows in the list as "Primary + Secondary", in the tech filter, in My View, in the two ticket exports (same Tech column), and on the Planner Day board, where the ticket also shows on the secondary's row as a dashed copy that opens the ticket but is moved from the primary's row. The secondary cannot be the same person as the primary.

### Left as is, on purpose

- PMs and installs have no secondary tech.
- The new-ticket form has no secondary tech; it is set on the ticket after it is opened.
- Spec sheets read by AI are still filed by the maker and model the sheet states, not the file name.
- A document added from the top-level Add Files with no maker in its name and no matching chip still opens the model picker.

Gates: lint 0 errors, typecheck and build pass; tests 170 passing, 9 failing (the same 9 Grok share-card failures). All 18 routes load.

## 11. Troubleshoot, PM Guide, File Rename

Checked in the running app at 1280px and 390px with a stand-in manual and parts book written for the test, and a stand-in for the AI service. The real AI and real manufacturer manuals were not exercised here.

### Changed

- **Troubleshoot** on each variation, under its spec, manuals and parts. One field for the issue. It reads only that variation's manuals and parts files.
  - The text of each stored PDF is read once in the browser, page by page, and kept (`library_file_text`). Scans, Word files and pictures are marked "can't be read" and are not guessed around.
  - The pages that hold the issue's words are sent to the AI with a page tag. The answer comes back as causes, checks (manual order), the manual's test, and the parts the manual calls for, each naming its page.
  - Every line is checked against the page it cites. A line whose words are not on that page is dropped. A part number is shown only when it is printed on the cited parts-book page; otherwise the part reads "Not in the parts book" with a web search link for the part name and model.
  - No manual, or none with readable text: it says so and stops. The files don't mention the issue: it says so. Nothing comes from another model.
  - Grinders: water and drain steps are removed.
  - **Explain In Plain Language**: an assist pass over the cited pages. Each line cites its page; a line that is not about its page is dropped.
  - **Mark Fixed** saves the variation, issue, cause, checks that worked, part number, who and when (`library_fixes`). **Past Fixes** show above the next result when the issue is similar, on the same variation only.
  - Limit: 40 lookups per person per hour.
- **PM Guide** added to the manual types.
- **File names.** The manual type picker has an optional File Name field. In Manage, every file has a rename button. The stored file and links already sent are unchanged.

### Left as is, on purpose

- A manual over 25 MB is not read for Troubleshoot.
- "Similar issue" is a word match (half the shorter issue's words in common), not an AI judgment.
- Everyone with Desk access can troubleshoot and mark fixed. Adding and renaming files stays with Admin and Sales.
- Past fixes cannot be edited or deleted from the screen yet.

Gates: lint 0 errors, typecheck and build pass; tests 178 passing, 9 failing (the same 9 Grok share-card failures). All 18 routes load. Migration 0047.

## 12. Troubleshoot Uses Only Files Stored On That Model

- A fix may use only the variation's spec sheet, its manuals, its parts book, and past fixes saved on it. The spec sheet file is now read alongside the manuals. Nothing comes from another chip, another variation, or the web.
- Each line reads "From <file> · p. <n>" and links to that page of the file stored on the same chip.
- When the stored files don't answer the issue, it says "No file on this model for this issue." and stops.
- A part the parts book doesn't list reads "Not in this model's parts book". The web search link added in section 11 is removed.

Checked in the running app with the stand-in files: every cited link pointed to a file stored on the open variation; no outside links in the panel.

## 13. Main Chip Manuals Copy To Every Variation

- The main chip is the variation named like its parent (AXIOM under Axiom). It leads the variation row.
- A manual on the main chip shows on every variation of that parent, with its type, marked "from <main chip>". It is one stored file, not duplicates, so a later variation gets it too and a rename or new upload is the same everywhere.
- Spec sheets and parts diagrams do not copy. A manual added on a variation stays on that variation.
- On a variation, Manage shows Remove Here on a copied manual. That hides it on that variation only (`library_file_hidden`, migration 0048). The main file and the other variations keep it. Put Back restores it.
- Deleting the manual on the main chip removes it everywhere; the confirmation says so.
- Troubleshoot on a variation reads the copied manuals too, and not one that variation removed.
- Applies to every parent already in The Library: the rule is worked out from the chip names, so nothing was moved, merged or renamed. A parent with no chip named like it (for example G9 with only G9-2T) has no main chip, so nothing copies there.

Checked in the running app: a manual added on the Axiom main chip showed on all six other Axiom variations; removed from Axiom-DV-APS it stayed on the main chip and the other five; the stored file still opened.

## 14. Customer Window Blocks, Optional Notes, Existing Equipment, Faster Fix

Checked in the running app at 1280px with stand-in files and a stand-in AI.

### Changed

- **Customer window.** Pre-Inspection and Equipment On This Account are each one collapsed row with a unit count ("4 units"). Clicking expands. With one open install, expanding Pre-Inspection shows its units straight away.
- **Notes are optional.** N/A no longer needs a note. Pass and Fail still need a photo. This changes one pass/fail rule on request: `itemSaveError`.
- **Existing equipment.** A unit can be New Install, Replacing Existing Equipment, or Existing Equipment. Existing Equipment is marked Pre-Inspected and highlighted, counts as passed, shows no utilities to re-shoot, and has an optional note (`install_inspection_units.note`, migration 0049). New Install and Replacing are unchanged.
  - A unit is treated as existing on its own only when the account already holds that exact unit: a serial and an install date on its account equipment line. A unit with no serial is never assumed to be existing; someone picks Existing Equipment for it. Any choice made by a person wins.
- **Faster Fix.** Troubleshoot now answers in two steps. First, a plain search of the files stored on that variation returns the matching lines, each with its file and page, and that variation's past fixes. No AI is used for this step. If nothing matches it says "No file on this model for this issue." at once and stops. Second, only when lines were found, the matched pages are read for causes, checks, the manual's test and parts, as before.
  - Files not read before are read at the same time, not one after another.
  - Fewer pages are sent for the second step (20,000 characters of manual text, 10,000 of parts), down from 48,000 and 24,000.

### Measured on the test copy

- First search on a variation, three small PDFs not read before: matching lines in about 4 seconds.
- Later searches: matching lines in under a second. No match: under a second.
- The second step's time depends on the real AI and was not measured here.

Gates: lint 0 errors, typecheck and build pass; tests 182 passing, 9 failing (the same 9 Grok share-card failures). All 18 routes load.

## 15. Parts Files Keep Their Name And Copy From The Main Chip

- A parts file is stored under the name it was dropped with. It is no longer renamed "<Model> - Parts Book". The row shows that name with the PARTS tag. Moving it to another model keeps the name. The rename button still works.
- Parts files that were already given a generated "- Parts Book" or "- Parts Diagram" title get their original name back (migration 0050). A name someone typed is left alone.
- Parts files on the main chip now copy to every variation, the same as manuals: one stored file, same name, on each variation; Remove Here takes it off one variation only; a parts file added on a variation stays there. Spec sheets still do not copy. This replaces "parts stay on the variation" in section 13.
- Troubleshoot on a variation reads the copied parts file for part numbers.

Checked in the running app: a parts PDF dropped on the Axiom main chip showed under the same file name on Axiom and all six other variations after a refresh; removed from Axiom-DV-APS it stayed on the rest.

## 16. Existing And Replacing Are One Choice

- A unit is New Install or Existing Or Replacing Equipment. The separate Replacing Existing Equipment button is gone.
- The combined choice behaves as Existing did: Pre-Inspected, highlighted, counted as passed, no utilities to re-shoot, optional note.
- The "same site requirements? copy from the old unit" step is removed from the screen. Nothing needs copying when nothing is re-shot.
- A unit saved earlier as Replacing is now treated as existing and reads Pre-Inspected. Results already stored on it are kept in the data.
- New Install is unchanged.

## 17. Water Only When The Unit Needs It, And The Tech Request Form

### Water and drain

- A water inlet is no longer added just because a unit was added. A blank new sheet starts with no inlet.
- Grinders (G9, G9-2T, Mazzer, Mahlkonig, any catalog grinder): no water inlet, no drain.
- No water called for on the sheet: Water and Drain is left off.
- Water is indicated (brewer, espresso, tea, or the sheet names a water line, pressure, or drain): Water and Drain shows, inlet 3/8" compression valve.
- Sheets already uploaded follow the same rule when they are opened. A 3/8" inlet that was only our default is dropped from a unit that does not need water. An inlet the sheet itself states is kept.
- The Specs row reads "Power, Plug, Size" when there is no water, "Power, Water, Plug, Size" when there is.

### Tech Request Form

- Each open install row has a checkbox: Tech Request Form issued. It starts unchecked and is never checked automatically (migration 0051).
- When a tech is assigned to an install (row, install window, or Planner Day board), the rep on the account gets a ping: "<tech> is assigned to the <account> install. You are good to issue the Tech Request Form." Clicking it opens that install.
- No ping when the tech did not change, when the install has no rep, or when the rep is the person who assigned the tech.

### Left as is, to confirm

- Only Sales and admins can check the box. Others see an error.
- The ping reaches a rep only if their Desk username contains their name (for example sean.marshall for Sean Marshall). A rep with no Desk sign-in gets nothing.
- A unit that is not a grinder, has no category, and whose name and sheet say nothing about water gets no inlet. Add the inlet on the sheet if it needs one.

Checked in the running app: G9-2T shows no Water and Drain; ITCB-DV keeps 3/8" compression valve; a tech assigned by one user pinged the rep once, the ping opened the install, the box stayed unchecked until the rep checked it.

### Follow-up: checkbox also in the install window

- "Tech Request Form issued" now also sits at the top of the install window, under the badges, so it is there when a rep arrives from the ping. Same box, same rule.
- On the board row the label is darker so it is easier to see.
- It shows on Prep rows only. Installed rows do not show it.

## 18. Pre-Inspection: Checks By Model, Drop Photos, Auto Pass, Next Machine

### Checks by model type (read from the model on the account)

- Grinder (G9, G9-2T, Mazzer, Mahlkonig, LPG, Swift, Robur, any catalog grinder): Power and Space.
- Brewer (Fetco, Bunn Axiom, ITCB, ITB, ICB, CWTF, TB3, Nitron, Curtis, Bravilor Sego, tea brewers): Power, Water and Space.
- Espresso (La Marzocco, Linea, Strada, GS3, Rancilio, Classe, Nuova Simonelli, Eversys…): Power, Water, Drain and Space. The core hole question stays under Space.
- Ethernet only on Eversys (Cameo, Enigma, e4 / e4s, Legacy, Shotmaster).
- A hidden check is not shown, not counted and never waited on. A result saved earlier on a now-hidden line is kept in the data but ignored.
- The Pre-Inspected text names only that unit's checks.

### Drop photos

- Each Add Photo button takes an image dragged from the computer, as well as Camera and Library. Several dropped at once all attach. The photo goes to that machine and that utility. Click still enlarges; Download still works.

### Passed as soon as the checks that model uses are done

- A unit is Passed once every check it uses is Pass or N/A. Photos stay required on Pass and Fail; N/A needs no note.
- The account count (2/3) and the install-board badge update in the same save. Existing equipment still counts as Passed. Any Fail → Failed; any open unit → In Progress.

### Next Machine

- Opens the next unit with the pre-inspection section at the top of the window and the first check selected.

### Two bugs found while checking this, fixed

- Opening a pre-inspection added another copy of a machine whose typed name differs from the catalog name (for example "Bunn ITCB-DV" stored as "Bunn ITCB"). Every load added one, so counts like 4/37 kept growing. The unit is now matched on either name. Copies it already made are taken off the visit when nothing was entered on them (no check, photo, note or New/Existing choice); the stray account row is removed only when no other visit, photo or Eversys module uses it.
- Closing the install window could split "Bunn ITCB-DV" into "Bunn ITCB" and a machine named "-DV". A bare suffix now stays with its machine, and a saved "-DV" machine is dropped.

### Left as is, to confirm

- Units that are not a grinder, brewer or espresso machine (for example EZRO200-10, or a unit saved only as a serial number) get Power and Space. Tell me if any of these need Water or Drain.
- Old account rows that list several machines in one name (for example "BUNN ITCB & BUNN G9 GRINDER") take the first type that matches, which is grinder. These rows are split into separate units when the install's equipment is saved.
- The core hole question still shows under Space for every type, as before.
- A copied unit that someone already touched is left on the visit; remove it by hand.

## 19. Deal Window: Package Amount, Invoice Or Sales Order, Every Machine In One Section

- New Deal: "Deal amount ($)" is now "Equipment Package Amount ($)". Same field, same number. The deal window's "Amount" reads Equipment Package Amount too.
- Deal window: "Invoice #" is now "Sale Invoice # Or Sales Order #". One field; either number goes in it.
- Equipment on a deal is one section of rows: model, serial, voltage, location. Add Equipment picks a model and adds a row in the same section; the X takes a row off. Adding or removing a row saves right away; serial and voltage save with Save or when the window closes (migration 0052, deals.machines).
- More than three machines: the section folds to one line with the count and the models; click Equipment to open it. A new row opens it.
- A deal opened from the customer window keeps the account: no second customer picker. From the Pipeline page the customer can still be changed.
- Older deals that only had an equipment line are split into rows the first time they open.
- When a deal is marked Complete and a new install is made from it, every row goes to the install with its serial and voltage, so pre-inspection gets each unit (and its checks by model). Existing equipment with a serial and install date still marks Pre-Inspected.

### Left as is, to confirm

- When the account already has an open install, completing the deal links to that install and does not add the deal's machines to it (unchanged). Rows added to a deal after it was handed off do not reach the install. Add them on the install.
- The New Deal window still takes one model; the rest are added as rows in the deal window that opens right after Create.
- The window title stays "New Deal".

## 20. Clean Names: Apply The Clean Customer List, Lock, Review

New page: Accounts > Clean Names (/customer-names). An admin presses Read Clean List and picks the NetSuite export (the Customers sheet is read; the Duplicates and Summary sheets are ignored, so no separate duplicate cleanup runs). Migration 0053.

### What it does

- Name on a row: Customer Name (the Entity ID is the same on every row but one, where it is cut off). Invisible characters from the export (zero-width spaces) are dropped.
- Exact match (same name once case, spacing and punctuation are ignored): the KatzDesk name is set to the clean-list name and locked. Most already match; the few that change are renamed in batches so a long list never times out.
- A locked name is not changed by Corrigo import (a Corrigo spelling of a locked name is written as the locked name) or by typing over it (rename is refused; typing a new spelling in a customer field picks the locked account). Only Unlock on Clean Names opens it. New customers can still be added.
- Similar (Needs Approval): same words with Inc / LLC / Co, the same name under a NetSuite parent ("Eversys Service:…"), extra words such as a location, words in another order, or a spelling difference. Up to three clean-list names are offered per account. Nothing changes until Approve. Approve renames and locks; the other names offered for that account are skipped.
- When the clean-list name is already held by another KatzDesk account, the line says "Approving merges into …". Nothing merges unless approved.
- No Match: KatzDesk accounts with nothing like them on the list. Keep locks the KatzDesk name; Mark Removal only flags it (shown on Customers as "Flagged for removal").
- Walk-In and Cimbali: every account with Walk-In or Cimbali in its name or its match, matched or not, plus list rows with no KatzDesk account. Not locked until approved. Approving a list-only row adds the account with the clean name, locked.
- One report, five sections: Approved And Locked, Needs Approval, No Match, Walk-In, Cimbali. Each account is in one section. Search and Waiting Only filter it.
- Nothing is deleted. Reading a new clean list starts a new report; names locked earlier stay locked.

On the test copy with the attached list (2,409 names, 2,650 KatzDesk accounts): 2,028 locked as exact (2 renamed: "waller county court house" → "Waller County Courthouse", "Scrambles Breakfast & Lunch" had a hidden character), 340 need approval, 235 no match, 67 Walk-In, 47 Cimbali. 321 of the Needs Approval lines would merge into an account already locked.

### Left as is, to confirm

- Confirming a removal is not built yet: flagged accounts stay until you say how removal should work (archive like Remove on Customers, or delete).
- Punctuation-only differences ("H.E.B" vs "HEB", "Porsche St. Louis*") count as exact. Two clean-list rows with the same name go to Needs Approval to pick one.
- Clean-list rows that match no KatzDesk account (other than Walk-In and Cimbali) are not added.
- Approving a parent-prefixed name sets the full name as written on the list ("Eversys Service:Black Rifle Coffee").

## 21. Admin Role, And ID, Address And Rep On Approved Accounts

### Admin role

- Access: the role picker has Admin, Sales, Service, Warehouse. Only the desk owner sets roles; more than one person can be Admin.
- Admin opens Clean Names (it shows in the menu only for Admin and the desk owner), reads the list, approves, skips, flags removal, unlocks, and sees ID and address.
- Sales and Service: no Clean Names in the menu, the page says only an Admin can open it, approving is refused, and a locked name cannot be changed (renaming is refused). Warehouse is unchanged.
- An Admin's other screens look like Service's (My View and dashboard read "Admin").

### ID, address and rep, approved accounts only

- Approved (locked from the list: exact matches, and lines you approve) carry onto the account: Display Name (locked), ID (the list's Internal ID), Address (ship-to address 1 and 2, city, state, zip), and the account rep from the list's Sales Rep (migration 0054).
- Needs Approval, No Match, Walk-In and Cimbali lines show no ID or address and write nothing onto the account until approved. Keeping a No Match account locks its name only.
- Rep: matched to the KatzDesk rep list by name or initials; a one- or two-letter slip still matches ("Bill McKinsley" is Bill McKinley). No sales rep on the list: rep blank, flagged "No sales rep on the clean list". A rep KatzDesk does not have: rep blank, flagged with the name. The flag shows under Rep on the account and on the report line. A rep is never made up.
- On the account: the ID and address block shows to an Admin; Sales and Service see the locked display name only.
- Reading the list again keeps what was decided (skips, removal flags, kept, unlocks, approvals) and never unlocks a locked name. It also fills ID, address and rep onto accounts approved before this change.

On the test copy (2,029 approved): 1,542 reps set from the list, 289 blank with no sales rep on the list, 198 blank because the rep is not on the KatzDesk rep list (Karla Zapata 188, Avi Katz 6, Rachael Gaytan 2, Wil Benitez 2). Re-reading unlocked nothing.

### Left as is, to confirm

- Karla Zapata, Avi Katz, Rachael Gaytan and Wil Benitez are not on the KatzDesk rep list, so their accounts have a blank, flagged rep. Add them as reps (or tell me to map "Avi Katz" to the AK mark) and read the list again to fill them.
- The list's rep replaces the KatzDesk rep on approved accounts, including blanking it when the list has none.
- An Admin can open Clean Names but cannot approve desk logins or rename unlocked customers; those stay with the desk owner.

### Follow-up: ID and address missing on the live site

- Cause: ID, address and rep come from the list file and are written when the list is read. A list read before section 21 has none of them, so accounts approved from it stay blank until the list is read again.
- Clean Names now says so at the top ("ID, address and rep are not on the approved accounts yet", or how many approved accounts are missing them) with a Read Clean List Again button. The account window says "ID and address are not filled yet" instead of a blank.
- Reading the list again fills every approved account, keeps every lock and decision, and unlocks nothing (checked on the test copy: 2,030 accounts filled, 0 unlocked).

## 22. Clean Names: Choose The Name

- Every line on the report (any section, approved or not) has Choose Name. It opens a short list:
  - the suggested clean-list names for that account (all of them, when more than one was found),
  - Keep the KatzDesk name as it is (locked; no list ID or address),
  - a search of the whole clean list, showing each name's ID, address and sales rep.
- Use This Name And Lock applies the name you picked, locks it, and writes that list row's ID, address and rep onto the account. Other names offered for the same account are marked skipped.
- If another KatzDesk account already has the chosen name, the option says "merges into …" and choosing it merges, as with Approve.
- A No Match account can be given any name from the list this way; it then shows under Approved And Locked.
- Searching the whole list needs the list read once after this update (migration 0055 keeps the list's rows with the report). Until then the panel says so and the suggested names and Keep still work.

## 23. Clean Names: Choose Name From Every Customer, And History On Each Row

- Every row that is not locked shows Choose Name (a filled button) next to Approve. It opens the full KatzDesk customer list (every account, searchable), with similar names pinned at the top and then all accounts A–Z, each with its record count and a lock mark if locked.
- Use This Account ties the row to the account you picked:
  - a row with a clean-list name: that account takes the clean-list name, is locked, and gets the list's ID, address and rep. If the row had another account on it, that account stays on the report as its own line (No Match, Walk-In or Cimbali), so nothing drops off. A locked account cannot take another name until it is unlocked on its own row.
  - a row with no clean-list name (No Match, Walk-In with no match): the row's account becomes the one picked (merged into it) and is locked. Picking the same account keeps and locks its name.
- History shows under the name on every unlocked row: service and TLC tickets, PMs and installs on that name, newest first (type, WO / ST #, date, status, notes; up to 6, with a count of older ones). "No history on this name" when there is none.
- Locked rows have no Choose Name and no history. Walk-In and Cimbali lines are never removed by choosing.
- The page shows its version at the top ("Oct 12 · Choose Name from all customers + history"). If the live page shows anything older, or no version line, the live site has not been updated yet.
- The clean-list search from section 22 is replaced by the full KatzDesk list on the row; the list's own names still come in as each row's suggested name.

## 24. Clean Names: Remove Name, Clickable History; Menu Order

- Remove Name shows on an unlocked row only when its history says "No history on this name". It takes that name off the review list; the KatzDesk account is not deleted or changed. The server refuses it on a name with tickets, PMs, installs or deals, and on a locked match. Reading the list again keeps removed names off.
- Each history line (Service, TLC, PM, Install with WO / ST #, date, status, notes) is a link that opens that record in a new tab, so the review stays where it was.
- Side menu: Installs is Pipeline, then Board. Recipes moved under Accounts, right after Customers. Coming Due and Planner unchanged.
- Page version: "Oct 12 (2) · Choose Name, clickable history, Remove Name".

## 25. Address And Map Pin On Tickets, PMs, Installs And Deals

- Under Customer on a service ticket, TLC, PM and deal, and at the top of the install window, the account's address shows with a map pin. Clicking it opens the address in Google Maps in a new tab. It follows the customer if the customer is changed on the ticket.
- The address is the one written onto the account from the clean list (section 21), so it shows for approved accounts once the clean list has been read after that update. Anything else shows "No address on this account yet. It fills in when the account is approved on Clean Names."
- On tickets the address shows to everyone (techs need it). The list ID still shows to Admins only, on the account.
- The ticket's customer must be the account's name (as it is when picked from the customer list). CoCo's - Sugar Land is on the clean list as 13533 University Blvd #200, Sugar Land, TX 77479.

## 26. Account Number On Customers

- Data (migration 0056): directory_customers.account_number, text, nullable. Kept exactly as typed apart from trimming outside spaces, so "00042" and "A-0099" stay as they are. Unique when filled in, ignoring case and outside spaces (a partial unique index); blank on any number of accounts. Removed (archived) accounts do not hold a number.
- Customer window: Account Number box under the clean-list block, above Rep. An Admin (the Admin role or a desk admin) can set or clear it; Save checks no other customer has it ("Account number 00042 is already on “Texican Court”."). Everyone else sees it read-only. Each change is logged on the account's activity.
- Customers list: Account # on each row, sort "Account # · Low → High / High → Low" (blank last, numbers compared as numbers), and the search box finds account numbers.
- Clean Names: each row shows "Account # …" read-only.
- Installs Board rows and Pipeline rows: "Account # …" under the account name when there is one.
- Exports: every report with an Account column (Pending services, PMs, TLC, Installs) gets "Account #" right after it. Customer, install, deal and ticket JSON from the app carry accountNumber.
- Import Account Numbers (Customers page, Admin only): a CSV (or sheet) with a customer column (name or clean-list ID) and account_number. The preview sorts every row into Will Save, Already Set, Conflicts (number on another account, number or account twice in the file, account already has a different number, no number) and Unmatched (no account, or more than one look-alike). Nothing saves until Save; only Will Save rows are saved, checked again at save time, and only onto accounts that have no number yet.
- Names, merges, locks, reps, IDs and addresses are not touched by any of this.

### Left as is, to confirm

- The import never replaces a number an account already has; change those one at a time in the customer window.
- Account numbers are matched case-insensitively for uniqueness ("A-7" and "a-7" are the same number).

## 27. No Account Number = Flag For Review, Never Remove

Rule: an account with no Account Number is never removed. The remove action flags it for review instead.

- Customers page: the Remove button reads **Flag For Review** on accounts with no Account Number. It sets the review flag (the account stays on the list, shown as "Flagged For Review"); once flagged the button shows **Flagged** and is disabled. Accounts that have an Account Number keep the normal **Remove**.
- Server (`archiveDirectoryEntry`, customers): checks the Account Number itself, so no screen can remove a no-number account. It returns `flagged: true` instead of archiving. Customer pickers that use the same call keep the account in the list and say it was flagged.
- Clean Names: **Remove Name** reads **Flag For Review** when the line's account has no Account Number. It flags the account and keeps the line on the report (chip "Flagged For Review", note "No Account Number: flagged for review, not removed."). Lines with no KatzDesk account behind them are unchanged.
- The "Flagged For Removal" chip now reads "Flagged For Review" (same flag as Mark Removal).
- Nothing is deleted. Existing flags, names, locks, merges and numbers are unchanged.

Left as is, to confirm: once an account gets an Account Number, Remove works as before (archives it). Say if accounts with a number should also only be flagged.

## 28. Charges On Tickets, Billing Hand-Off, Items And Prices

Goal: stop re-keying Corrigo invoices into NetSuite. Katz Desk collects the charges; the Sales Order is still made in NetSuite by the billing script. Nothing writes to NetSuite from here. Migration 0057.

- Ticket window (service and TLC): a Charges section. Trip Charge and Labor Hour are one click each at $150, named exactly as NetSuite has them (`Service : TRIPCHARGE`, `Service : SERVICELABOR`). A part is picked from the item list by SKU, manufacturer number or words. Qty, rate and description can be edited. P.O. # and the NetSuite Sales Order number are kept on the ticket.
- Billing state on the ticket: No Charges, Ready To Bill, or Billed with the SO number. A billed ticket's charges are locked until the SO number is cleared.
- Export Billing (Tickets and TLC, under Export): one CSV row per charge line for tickets completed in a date range that have charges and no Sales Order yet (WO, PO, customer, account number, list ID, tech, item, SKU, qty, rate, amount, work done). It also lists completed tickets with no charges, which is usually a missed bill.
- Items And Prices (Tickets, under Import, Admin only): drop the NetSuite item export or a price list, CSV or Excel, every sheet. Rows match on the SKU. A column the file does not have, or a blank cell, never changes what is saved, so a Name + Base Price file only moves prices. The preview shows old price, new price and percent, and lists moves of 50% or more first. A SKU that is not loaded is added only when the file has a Description. Nothing is deleted.

Checked with the real export (3,977 items on four sheets): loaded once, loading it again changed nothing, and a price-only file moved two prices without touching descriptions or cost.

### Left as is, to confirm

- The export lists items by bare SKU (`EVER104120`); invoices show a parent group (`PARTS : EVER104120`). The export has no parent column, so the group is only known for parts that were named with one. The billing CSV carries both Item and SKU.
- 34 items have no price and 48 are $0.00 in the export.

## 29. Part Photos, The Parts Page, MPN On Library Variations, Equipment Codes

Migration 0058.

- Parts (Shop > Parts): the item list with each part's photo and MPN. Add Photo / Replace Photo is on the part here. Trip and labor are not listed. Admin and Sales can set a part's MPN.
- The invoice picker and the saved charge line show that same photo next to the part name and MPN. Click or tap enlarges.
- No photo: a blank slot labeled with the MPN. With no MPN recorded it reads "MPN not set" with the SKU under it; the SKU is never shown as the MPN, and another part's photo is never used.
- Library variation: an MPN (two variations cannot share one), with a status. A stored file is tied to that MPN only with an https source, and only on the variation it sits on. A tied file cannot be moved and is not copied from a main chip; a shared manual with no MPN still copies as before (section 13).
- "No Official File For This MPN" is a flag on the variation. A different model's sheet is never attached in its place.
- Equipment Codes (The Library > Add Files > Import Equipment Codes): a worklist of Manufacturer, Model and MPN adds each model under its manufacturer. An MPN is recorded only when the row has one. Nothing is attached by it.

### Left as is, to confirm

- The NetSuite export has no MPN column, so nearly every part reads "MPN not set" until someone sets it.
- Of the 304 equipment item codes, 1 MPN was confirmed on the manufacturer's page (BUNN 53100.0100), 1 has no manufacturer page for that exact number (52000.0305), 6 are only suggested by the item code, and 296 are Katz names with no manufacturer number.

## 30. One Import Control, And A Run Back Through The App

### Import

- `ImportMenu` (in `desk-charts.tsx`): two or more imports show one **Import** button that opens a short list. Exactly one import shows that import's own button and no list. None shows nothing.
- The lines are left-aligned, one width, one height and one type (`ActionButton`). The list closes on a choice, when that choice finishes, on a click outside, on Escape and when focus tabs away. It has no backdrop and does not lock the page. While a file is being read the button says "Reading…".
- Customers: Import holds Account Numbers and Equipment List for an Admin; anyone else has one import and sees the single Import Equipment List button.
- Tickets: Import holds Corrigo Report and Items & Prices for an Admin; anyone else sees the single Import Corrigo Report button. Exports moved to their own Export list (Export Billing, Export). TLC has no import, so it has no Import control.
- Clean Names and The Library each have one import and keep one button. The Library's Equipment Codes import sits inside Add Files so the header is unchanged.

### Found and fixed on the way

- On a phone the list hung off the left edge of the screen (it always opened from the button's right edge). It now opens from the left edge when that is the side with room. This applied to the old Import / Export list and the Export lists too.
- A click inside a window opened from the list reached the list's own handler (React passes events up from a portal). The list now ignores anything that is not one of its own lines.
- Clean Names: the Customers button was shorter than Read Clean List beside it. Same height now.
- The hidden file inputs for the equipment and Corrigo imports were keyboard tab stops, one of them between the two lines of the list. They are out of the tab order now; tabbing past the last line closes the list.

### Walked and passed, no change needed

Every route loads with its heading, no page errors and no sideways scroll (20 routes, with Parts).

- Side menu: Installs is Pipeline, Board. Accounts is Customers, Recipes, Out Of Network, Clean Names. A non-Admin does not see Clean Names or Access.
- Clean Names: Choose Name opens the full list (all 2,627 accounts, searchable, similar names first). History shows on a row that has it; each line opened its ticket (a service ticket and a TLC ticket were opened). The remove button shows only on a row with no history, and reads Flag For Review when the account has no Account Number (section 27).
- Pre-inspection: grinder Power and Space; brewer Power, Water, Space; espresso Power, Water, Drain, Space; Ethernet only on the Eversys unit. A dropped photo attached. A grinder went to Passed when its two checks were done, and the Board badge moved to 1/3. Next Machine, pressed from the bottom of a unit, opened the next one at the top with the first check selected. The photo enlarged and offered Download.
- Library: one chip per variation. A manual and a parts book on the main chip showed on both variations; the parts book kept the name it was dropped with; a manual added on a variation stayed there. Fix cited the stored files by name and page, and answered "No file on this model for this issue." for a word that only another variation's file has.
- Banner search list stayed under the search box and on top of the banner after the page scrolled. A window taller than a short screen scrolled to its last button and the page behind did not move. Hover highlighted a ticket row without lifting it and lifted only the control under the pointer.
- Pings: sent from a second login and opened from the bell for a ticket, TLC ticket, PM, install, deal, rebuild and module. Each opened the record it named.

### Left as is, to confirm

- Import Account Numbers also applies a row that gives the clean-list ID in place of the name, and a row whose name differs from the account only in punctuation or spacing when exactly one account matches (section 26). A previewed file put "4 Bros Bagel" on "4-Bros Bagel" and "9001" on the account with that ID under Will Save. Say if those should stay in review.
- On the Board, after Next Machine the unit's "1/3 machines passed" line sits under the page banner. The unit name and the first check are visible.
- The Export lists on PMs and the Board hold one export each. They were left as lists.

## 31. Legacy Models

Migrations 0059 (columns) and 0060 (the review). Rules in `legacy-rules.ts`.

- Under each manufacturer there is a Legacy row for models the manufacturer lists as discontinued or obsolete. It is its own labeled row ("Legacy · discontinued or obsolete models"), not a family chip, because Eversys makes a machine line called Legacy.
- A Legacy model keeps its spec sheet, manuals, parts and MPN, still opens, and is never deleted. Its family row loses the chip; a family with nothing left in it drops out of the Family row.
- Move To Legacy (Manage, Admin and Sales) always asks for the manufacturer page. Without an https source the server refuses. Move Back To Current undoes it.
- Confirm Legacy is a flag for a model that could not be confirmed either way. It stays in the main row, with what was found, until someone confirms it.
- The Library row has two filters: Legacy and Confirm Legacy, each with its count.

### Review of the 30 models in The Library (Oct 12, 2026)

Checked against each manufacturer's own site. BUNN Product Manuals (manuals.bunn.com) sorts every part number into Current Models or Discontinued Models, which settled all ten BUNN models.

- **Moved to Legacy: none.** No model in The Library is listed as discontinued or obsolete by its manufacturer.
- **Flagged Confirm Legacy: three** (set by migration 0060, matched on the model's exact name):
  - BUNN G9-2T HD Stainless: BUNN's sales page for 24250.0021 says it may no longer be available for purchase; BUNN Product Manuals still lists 24250.0021 as current.
  - FETCO CBS-1250 Plus: not on FETCO's current brewer list; its user guide is still under the current Plus Series and it is not on FETCO's Legacy Models page.
  - Eversys Enigma e'4 X-Wide: X-Wide is not shown on Eversys's Enigma page; no discontinued notice was found.
- The other 27 are shown as current products.

Checked in the running app with a model BUNN does list as discontinued (41400.0300, the old-style ITB dual dilution, which is not in The Library): it moved under Legacy with the source, still opened, and its MPN stayed with it.

### Left as is, to confirm

- A model's status is matched from its name. The BUNN chips do not carry a part number, so each was matched to the BUNN number its name describes (for example AXIOM-DV-APS to 38700.0010).
- A newer version of a model existing (Linea PB X, Legacy+) is not treated as the older one being discontinued.

## 32. Unofficial Sources Under Fix

Migration 0059, table `library_unofficial_sources`.

- Fix is unchanged: it reads only the files stored on that variation (spec sheet, manuals, parts book, past fixes), names the file and page on every line, and says "No file on this model for this issue." when nothing matches.
- Under it, Unofficial Sources lists links and notes that are not the manufacturer's manual. The block and every line are labeled Unofficial, and the block says it is not a manufacturer procedure.
- Anyone on the desk can add a note, a link or both, shown with their name and the date. The person who added it, or Admin and Sales, can remove it. A link has to be a web address; anything else is refused.
- Troubleshoot never reads this table. Checked: a word that exists only in an unofficial note returned "No file on this model for this issue."

## 33. One Search-And-Filter Row

`ListToolbar`, `ToolbarSearch`, `ToolbarSelect` in `list-toolbar.tsx`; chips are `FilterChip`.

- Search on the left (one width, with the search icon), filters in line with it, every control 36px tall, one chip shape, pick-lists in the same pill as the sort.
- Applied on Tickets, TLC, PMs, Pipeline, Board, Warehouse, Rebuilds, The Library, Parts, Locations, Modules, Customers, Out Of Network and Clean Names. Measured on all fourteen at desktop width, and on Clean Names and The Library at phone width.
- The Library: the search moved out of the header into this row, with the Legacy and Confirm Legacy filters. Family and variation chips are the shared chip (36px; they were 44px with a border).
- Clean Names: the search leads the row and the five sections and Waiting Only sit in line with it.
- Modules: the Available (HQ) / Assigned / All switch is three chips. Rebuilds: its bordered chips and the Board / Timeline buttons are the shared chip. Pipeline: its own copy of the chip is gone.

Gates after sections 28 to 33: typecheck and the production build pass, lint has 0 errors, tests are 238 passing and 9 failing (the same 9 Grok share-card failures). All 20 routes load.

## 34. Education And Training In The Library

Migration 0061. Rules in `training.ts`, server in `training-api.ts`, screen in `training-section.tsx`.

- The Library has an Education And Training section under the search row, apart from the model books. Five topics: Water Specs, Coffee 101, Barista 101, Latte Art, Importance Of Cleaning. Each topic shows its file count, and all five show even when empty.
- A topic stores files. Drop them on the topic, or use Add Files. PDF, images, Word and PowerPoint, up to 20 MB each. A file keeps the name it was dropped with.
- Click a file name and the file opens in a new tab. Email and Text send a link to the file, the same as a manual.
- Admin and Sales add and delete (the Library's own rule). Everyone on the desk can open and send.
- Training material is never filed under a machine. The files sit in the same table as Library files with section `training`, a topic and no book, and the database refuses a training row that has a book. The model-book list, the by-name auto-filing, Move and Set Manual Type all skip them. Troubleshoot reads by book, so it never reads them.

Checked: a deck named "Axiom Cleaning Deck" dropped on a topic stayed in that topic after a reload and did not appear under any Axiom variation.

## 35. Side Menu By Department

`shell.tsx`. Coming Due sits alone at the top. Then:

- Accounts: Customers, Recipes, Out Of Network, Clean Names.
- Installs: Pipeline, Board, Handoff.
- Service: Tickets, PMs, TLC + Factor, Rebuilds, Planner.
- Shop: Warehouse, Modules, The Library, Parts, Locations.
- Reports: Analytics.
- Admin: Settings, Access.

Nothing was taken off the menu. Parts and Locations were not in the new order, so they stay at the end of Shop. The page names are unchanged (Tickets, TLC + Factor, The Library). Who sees what is unchanged: Clean Names and Access are Admin only, and the warehouse role still sees its four pages.

## 36. Analytics And Export

Rules in `analytics.ts`, file writers in `report-files.ts`, server in `analytics-api.ts`, page at `/analytics`.

- One list of installs, service tickets, PMs, TLC tickets and rebuilds. Columns: Type, Account, Account #, Date, Status, Rep, Tech / Owner, Reference, Detail.
- Date is the install date, the completed or scheduled date, or the day the record came in, in that order. Rep is the rep on the record, else the rep saved on the account.
- Filters: search, This Month / Last 90 Days / This Year / All Dates, From and To, rep, and the five type cards. The cards always count all five types for the range.
- Export is PDF, Excel or Word. All three are written from one report built from the filters on screen: the same title, scope line, summary table and record rows. A long Detail is cut at 160 characters before any file is written, so no format holds more than another.
- The PDF and Word files are written directly (no new library). Excel uses the SheetJS library already in the project.

Checked with the local data (797 records): the Word table matched the Excel sheet cell for cell, and every cell was found in the PDF (32 pages, header row on each). Excel and Word each opened their file.

## 37. Deal, Board, Install Ticket

Rules in `deal-board.ts`. Machine rows carry the new fields (`machines.ts`). Migration 0063 is an index only.

- Create A New Deal takes more than one machine. Each is marked Sold or Loaned there or on the deal.
- A machine row on the deal has Sold or Loaned, serial, voltage, plug, water, coffee and recipe. A grinder has no water field: it reads "No water or drain".
- Confirm sends one machine to the Board for prep. It must be marked Sold or Loaned first. Everything set on the row goes with it.
- With no project open for the deal or the account, the machine starts one. Otherwise it asks: Continue Under This Project (same board card) or Start A New Project (another card). A machine added to the deal later follows the same path.
- A confirmed row on the deal is read-only and says which project it is on and where that project stands, with a link to it. It is changed on the Board from then on.
- The Board card lists each machine with a Sold or Loaned badge, Confirmed, and what was set. A deal with more than one card labels them Project 1 of 2, and each card links back to the deal.
- Install Ticket: when the project is Ready (equipment status Ready and pre-inspection passed), the install window shows the ticket on top and the Board row gets an Install Ticket button. The ticket is read from the project's machine rows: Sold or Loaned, serial, volts, plug, water (or "No water or drain"), recipe and coffee. A blank that should be filled is marked Not set. Print makes a paper copy.
- A deal row and its board row are tied by a hidden id, so renaming a model on the Board does not lose the link, and a machine taken off the Board reads as not confirmed again. Saving a deal from a window opened earlier does not drop a tie.

### Left as is

- "Deal completion: Complete" still hands the deal off the way it did: a deal with no install gets one holding every machine. Those machines now show as Confirmed on the deal.
- An install opened before this has no Sold or Loaned on its machines until someone marks them.

### To confirm

- The install ticket is a view of the install record, not a separate ticket on the Tickets page. Say if it should also open a ticket there.
- Confirm requires Sold or Loaned. Say if a machine should be allowed onto the Board unmarked.

## 38. Repair Quote

Migration 0062 (`repair_quotes`, `repair_quote_lines`). Rules in `repair-quote.ts`, server in `repair-quote-api.ts`, panel in `repair-quote-panel.tsx`.

- Repair Quote is on the ticket window (service and TLC) under Charges, and on the rebuild window. Lines are parts from the item list and labor hours, with qty and rate. It shows Parts, Labor and Total, and a status: Draft, Sent, Approved or Declined.
- A rebuild linked to a ticket uses that ticket's quote, and the ticket shows the rebuild's. It is one quote, shown in both places, and each says so. There is no second cost sheet.
- The rebuild row shows the cost: total and status on the board card and the timeline row, parts and labor on hover, and in the rebuild window's header.
- An Approved or Declined quote keeps its lines. Set it back to Draft or Sent to change one.
- The quote is separate from Charges. Charges are what gets billed; nothing is copied between them.

### To confirm

- If a rebuild and a ticket each already have their own quote and are then linked, each keeps its own. Nothing is merged.

Gates after sections 34 to 38: typecheck and the production build pass, lint has 0 errors, tests are 274 passing and 9 failing (the same 9 Grok share-card failures). Migrations 0061 to 0063 applied on the local database.

## 39. Branch Check: Training, Menu, Analytics, Deal To Board, Repair Quote

Pulled `desk-oct12-charges-library-analytics` (66a8816 + 3dedef1) and clicked through each feature. What was already right was left alone. Fixed:

- **Training, who can add:** Admin meant the desk admin flag only. Now the Admin role counts too (Library and Education And Training): Admin and Sales add and delete.
- **Training stays out of model-book tools:** rename, delete, copy-to-variation and MPN tie in the model-book code now skip section 'training' (Move and Set Manual Type already did).
- **Analytics:** the on-screen table now has its own Account # column, same as the exports.
- **Grinders with no "grinder" in the name** (Mythos, Bunn G1 / G2 / G3 HD) showed a Water field on the deal. They now read "No water or drain". Pre-inspection checks for them are unchanged (Power and Space either way).
- **Confirmed machines are read-only on the server too:** saving a deal can no longer change or drop a machine that is on the Board.
- **Repair Quote with no item list:** a line can be typed and marked Part or Labor ("Or type a line"). No part number is made up. A listed item keeps its own kind.
- **Rebuild cost:** the timeline row and the window header now say "No quote" when there is none, and show Parts and Labor on hover (the board card already did).

Checked with clicks: five topics, "Axiom Cleaning Deck.pptx" dropped twice (second became "(2)"), still in Importance Of Cleaning after reload and not in any model book; a .txt refused by name; delete behind Manage asks first. Menu order and Handoff under Installs. Analytics Excel, Word and PDF: Word rows equal Excel rows cell for cell (848 rows), every cell found in the PDF (37 pages, header on each, page numbers). New deal with Mythos (Sold) and a Linea; Linea refused until marked; Mythos confirmed (started Project); Linea asked Add To The Board, Start A New Project (Project 2 of 2); board cards carry everything set; install ticket opens once Ready with Not set on the blank recipe. Repair quote on a rebuild linked to a ticket: labor hour + typed part + typed labor = $466.00, Approved locks lines, same quote shows on the ticket, "Cost $466.00 · Approved" on card, timeline and header.

Left as is, to confirm: the local test desk has no NetSuite item list, so picking a part from the list was not clicked here; it uses the same picker as Charges.

## 40. Ticket Discount, Addresses, Module Asset Record, Role Views, Order Pings

**Discount on tickets (0064).** Charges on a ticket have Discount: Percent or Amount, one value. The panel shows Original Total, Discount and New Total; the header shows the new total with the original struck through. The discount is saved as the choice and its value (`service_jobs.discount_kind`, `discount_value`) and always worked out from the charge lines, never from a discounted total, so saving again never discounts twice. Percent is capped at 100; an amount never takes the total below zero. Billed tickets stay locked. Rules in `src/lib/ops/discount.ts`, tests in `scripts/discount.test.mjs`.
- Billing export: a discounted ticket gets one more row after its lines, item "Discount", qty 1, rate minus the dollars off, description "10% off". **To confirm:** the NetSuite item name the billing script should use for a discount.

**Addresses (0065).** Approved clean-list addresses are copied onto accounts that were still blank (only blanks; no name, lock or other field changes). The address shows in small type under the name with a pin on: the Customers list and the account window, ticket rows (Service and TLC) and the ticket window, PM rows, Install Board rows, Pipeline rows, and the deal and install windows. The pin opens directions (on a phone, the maps app); a row's own click is not triggered by the pin.

**Module asset record (0066).** Each module's window now shows Current Account, Current Unit, the Trail and Parts And Labor.
- Trail (`module_stops`): assigned, returned, swapped out, swapped in, and location changes typed on the record. Rows are only added; the last account is never overwritten. Seeded once from the activity log and from current assignments.
- Swap: on a module that sits on an account's unit. Only a module of the same type (and platform, when both are set) that is at HQ can go in. The incoming module goes on the same unit; the outgoing one comes back to HQ as Not Started (to be rebuilt). Both records get the stop with the account, date, the unit, and the other module's serial.
- Parts And Labor (`module_work`): Part (qty) or Labor (hours), date, WO. Added, never rewritten.
- New Module searches the list as the serial is typed (case and spaces ignored). A serial already there shows "already on the list · Open It" and cannot be added again; otherwise "Add As New".
- Rules in `src/lib/ops/module-history.ts`, tests in `scripts/module-history.test.mjs`.

**Role views.** Sales (not admin) sees Service as Tickets, PMs and TLC + Factor, filtered on the server to the accounts assigned to them (the account's saved rep), with a note saying so. Rebuilds and Planner are not on a sales rep's menu. Service techs and admins see the full Service menu. Installs, Shop, Accounts and Analytics stay visible to everyone; Clean Names stays Admin only; Warehouse is unchanged.
- **To confirm:** service techs still see Installs (Board and Handoff are used for installs); sales reps no longer see Rebuilds and Planner.

**Order pings.** When a deal changes to Good To Order, every Admin is pinged ("Good To Order · account"); when it is marked Ordered, the deal's sales rep is pinged ("Ordered · account"). The person who clicked is not pinged about their own change. Clicking the ping opens the deal.

Checked with clicks: 10% off $450.00 → $405.00, saved twice and reloaded, still $405.00; 120% refused. Address under Mod Coffeehouse on its service row; pin opens directions, row stays closed. Module QA-BM-OUT swapped for QA-BM-IN on Mod Coffeehouse's Cameo: both trails show the account, unit and the other serial; 2 parts and 1.5 h labor logged. New Module with an existing serial offered Open It and no Add. Lance (sales) marked a deal Good To Order → the Admin got the ping and its click opened the deal; the Admin marked Ordered → Lance got the ping. Lance's Service list showed only his accounts.

## 41. NetSuite Parts Import, Part Pricing, Our Discount Rule, Parts Profit

**Import Parts (NetSuite) (Import menu on Tickets and on Parts, Admin).** Excel with an MPN column (Name, Description, Base Price, Purchase Price, Class read when present). Matched on MPN (case, spaces and dashes ignored). An MPN already on a part updates it; a new MPN adds a part (SKU from Name, else the MPN). Never a second part for one MPN: the same MPN twice in the file keeps the first; an MPN two parts already share, or a new part whose SKU another part has, is shown as Not applied. Blank cells change nothing.

**Update Part Pricing (same menu, Admin).** Excel with MPN and Price (a New Price column wins). Matched on MPN only. The preview lists every row: MPN, part, old price, new price, % change. No Match and shared-MPN rows stay in the preview and are never written.
- The window asks which price the file holds: **Manufacturer Price** (default; new column `billing_items.list_price`) or **Our Sell Price** (the NetSuite Base Price). **To confirm:** manufacturer price is the right default for a price increase file.

**Approval before it runs.** Both imports open one window: file name, row count, what will change (counts and the line list). Approve runs it; Cancel closes and writes nothing. Reading a file never writes. Each approved run is logged in `part_import_runs` (0067).

**Our Discount Rule (Settings, Admin edits).** Percent off the manufacturer price, or a fixed dollar amount off it per unit, with a note. Cost of a part = manufacturer price less the rule; a part with no manufacturer price uses its NetSuite Purchase Price.
- On ticket lines that have a part (Admin sees it): Cost, Sell, Discount (ours, off the manufacturer price), the line's share of the ticket discount, and Margin (sell − ticket discount − cost) with %.
- Stored on the line when the ticket is invoiced (Sales Order number entered), so later price changes do not rewrite it. Clearing the Sales Order clears it.

**Analytics → Parts Profit (Admin).** Invoiced part lines per MPN: MPN, part, Qty Invoiced, Cost, Sell, Discount, Ticket Discount, Margin, Margin %, with date range and search. Export PDF, Excel or Word from one report (same writer as the records report): Word rows equal Excel rows; every cell is in the PDF. Lines invoiced before costs were stored are priced from today's part and rule, and the scope line says how many.
- **To confirm:** Parts Profit is Admin only because it shows cost and margin; the Records report stays open to everyone.

Checked with clicks: parts file (3 rows + a repeated MPN) → window Add 3, Cancel wrote nothing, Approve added 3, the same file again changes nothing. Price file: 104120 $15.75 → $16.50, MZ-BURR-64 $96.60 → $101.40, NOPE-777 No Match, Cancel left prices as they were. Rule 35%: ticket with 2 × 104120 and the 10% ticket discount → Cost $20.48, Sell $48.00, Discount $11.02, Ticket discount $4.80, Margin $22.72; stored at invoicing; Parts Profit shows both MPNs and exports in all three formats.

## 42. Remove Equipment From A Pre-Inspection

Each machine on an install's pre-inspection has a trash button. It asks first, then takes the machine off that pre-inspection with its checks, photos and note for that visit.
- A machine added at the site (Add equipment) just comes off.
- A machine that is on the install's equipment list comes off that list too (and the board card), or the next load would put it back. A machine confirmed from a deal reads as not on the Board again on the deal.
- The account's equipment record is removed only when it was made for this visit and nothing else uses it (no serial, no install date, no other visit, no photos, no module). Other installs and the account's history are not changed.
- An install already marked installed is left as it was.
- Each removal is written to the install's activity.

Checked with clicks: install with Mythos and Bunn Axiom-APS, Puqpress added at the site; removed Puqpress (pre-inspection only), then the Axiom (pre-inspection and equipment list); after a reload only Mythos is left, and the install's equipment reads Mythos.

## 43. Part Description And One Invoice Window

**Part Description.** Each part on Parts shows its Description next to its name, MPN and photo, and the invoice picker shows it under the part name with the MPN and photo. Blank when none is stored: nothing is ever filled in. Admin and Sales can Add or Edit Description on Parts (`setPartDescription`). A NetSuite item import that has a Description column still writes its own.

**Invoice, the same action on every customer record.** An Invoice button in the window of a service ticket, TLC ticket, PM, install, rebuild and deal. It opens the Invoice window; there is no separate page.
- Bill To: name, account number, address (pin for directions) and rep, read from the account (the account's rep, else the record's). The customer is never asked for; anything missing is named ("No account number") and fixed on the account.
- Lines: parts (photo, item, MPN, description, qty, price, amount) and labor (Labor Hour, Trip Charge). Add from the same part picker as Charges; remove with the trash on the line.
- Discount: Percent or Amount, one value. Parts, Labor, Subtotal, Discount and Total use the existing charge and discount math (`invoiceTotals` wraps `chargesTotal` and `applyDiscount`; no new rules).
- Approve saves; Cancel (or closing the window) saves nothing. Reopening reads what is saved, so a cancelled draft never comes back.
- Tickets: the invoice is the ticket's Charges. Approve writes the same lines and discount through the same code as the Charges panel (P.O. kept), so the billing export, Parts Profit and the Charges panel read the same thing. A billed ticket's invoice is locked until its Sales Order number is cleared. If the Charges change after approval, the window says so.
- Other records: lines in `invoice_lines`, discount and approval in `invoices` (0069), with the billing info as it read at approval.
- Each approval is written to the record's activity.

**To confirm:** approved invoices on installs, rebuilds, PMs and deals are saved on the record but are not yet in the billing export (which is built for ticket charges and the billing script) or in Parts Profit. Say if they should be.

Checked with clicks: Add Description on a part with none, saved; the picker shows it under the part name with the MPN and photo. Mod Coffeehouse service ticket WO-0405 → Invoice → Bill To Mod Coffeehouse, account 00077, 2126 Post Office Street, Lance Oden; burr set + 1.5 h labor, 10% → $370.00 − $37.00 = $333.00; Cancel saved nothing; again with Approve → the Charges panel shows the same two lines and $333.00. Mod Coffeehouse install #364 → Invoice → the same window and Bill To; gasket × 2 + 3 h labor − $25.00 = $473.00, approved, reopened as saved. PM, deal and rebuild open the same window; billed ticket WO-9880 is locked; no sideways scroll on a phone.

## 44. Parts From The NetSuite Items File, Get Later, Photo Review, Account Tabs

**The file.** Import → Import Parts reads the NetSuite items export (NetSuite-Items-2026-10-12.xlsx: Parts, Filters, Equipment and Service sheets). On it, **Name is the part number (MPN)** and **Description is the part name**. Class, Base Price (rate), Purchase Price (cost) and Inactive are kept. Display Name is used as the name only when a file has no Description column.
- Match on MPN, compared without case, spaces or punctuation (`mpnKey`). If the part exists, it is updated. If not, it is added. A part loaded earlier with that number as its SKU and no MPN counts as the same part. Never a second row for one MPN; a number repeated in the file is counted as "Same MPN twice in file" and used once.
- Nothing is applied until Approve in the import window (the rule from 41). Blank cells do not wipe what is stored. Hidden parts are not touched.
- Nothing is added that is not on the file.
- Checked: the real file read 3,976 rows, Add 3,973, Update 2, Not applied 1 (a local test part whose SKU was taken), Same MPN twice 3. After Approve, running the same file again changes nothing.

**Class and Get Later** (migration 0070). Each part stores its NetSuite Class. Get Later is a checkbox on the part, anyone on the Desk can tick it, and it records who and when. It does not change price or stock; it only marks the part to pull later. Parts has a Get Later filter (with its count) and a Class filter. The Parts list and the invoice picker both show the part name, Part #, Class and Get Later.

**Photos.** A photo is attached only when it is the same MPN on at least 3 independent sources and those photos agree. Otherwise the part shows **Confirm Photo**.
- Research results live in `part_photo_research`: verdict, reason, the image to use, and candidates with site, source page and the part number the page shows.
- Pilot: 40 parts researched, 2 confirmed (BUNN32400.0003, FETCO1024.00020.00), 38 flagged. Flagged parts with candidates show **Review Photos (n)**: candidates side by side with the reason, the source page and photo address, Use This Photo or None Of These. Watermarked candidates cannot be used.
- Report: reports/NetSuite part photo sourcing.md (kept out of git).
- Photos are fetched through `/api/part-photo-source/:id`, signed in only, and only addresses on that part's research. This workspace cannot reach the photo sites, so the 2 confirmed photos are pulled on the live site with **Pull Confirmed Photos** (Admin). If a source does not answer, the part stays flagged.
- **One treatment for every photo** (researched or uploaded): trim the background border, center the part on a white 800×800 square with an 8% margin, turn leftover near-white background into the same white, JPEG. No watermark is ever used. Click any part photo to enlarge it.

**Account tabs.** An account no longer scrolls through stacked sections. The account window opens on tabs, one per category: **Details, Equipment, Tickets, Invoices, Pre-Inspection, Recipes**, with counts. Clicking a tab shows only that category.
- Equipment and Pre-Inspection show their lists right away (no extra click inside the tab).
- Invoices lists the account's ticket invoices (from Charges) and approved invoices on installs, PMs, rebuilds and deals. Each row opens the Invoice window from 43.
- The tab row scrolls sideways on a phone; the page does not.

**To confirm:**
- The Equipment and Service sheets were imported as items too (they are billable lines in NetSuite). Say if only the Parts and Filters sheets should be.
- About 3,900 parts have not been researched yet and show Confirm Photo. Researching the full list is a longer run in the same table.
- The research found data issues in the item list. Each needs a decision, not a guess:
  - OptiPure vs Pentair Everpure vendor label
  - Fetco 52018 marked discontinued, but Parts Town has stock
  - "was 95888900" is probably 958889000
  - numbers already superseded: Mahlkönig 309560 → 702926, Ditting 240078 → kit 703425, Fetco 24012 → 1024.00020.00, F.1.034
- A manual upload counts as confirmed by the person who uploaded it.

Checked with clicks:
- BUNN32400.0003 reads: BUNN TIMER KIT, DGTL-240V(NO ADPTR), Part # BUNN32400.0003, Class Equipment : Parts and Filters. Get Later ticked, and the Get Later filter shows 1. The row shows Confirm Photo and Pull Confirmed Photo; here the source cannot be reached, so the part stays flagged.
- The invoice picker shows the same name, Part #, class and Get Later.
- BUNN37192.0000 → Review Photos (2): Parts Town and HowdyBrewer, reason "Only 2 sources…".
- A 1400×800 sample photo with the part off to one side came out 800×800, centered on white, and enlarges on click.
- Mod Coffeehouse opens on tabs: Equipment 3, Tickets 5, Invoices (WO-0405 $333, Install #364 $473), Pre-Inspection 4.

## 45. Five Classes, Description As The Part Name, Five Account Tabs

**Five classes only.** Parts keep one of: **Parts, Water Filters, Service, Equipment, Dispensers**. Nothing else is added and the Class filter on Parts offers only these five, each with its count.
- The NetSuite file's Class column is a path ("Equipment : Parts and Filters", "Service : Catering"), not these names. The file has one tab per class, so the tab decides: Parts tab → Parts, Filters tab → Water Filters, Equipment tab → Equipment, Service tab → Service. A file without those tabs is read from the Class column's own name (first or last part of the path; "Dispensers" → Dispensers).
- A row whose class is none of the five is not added, and a part already listed in it is moved off the active list (`active` off, so it is out of the list and the invoice picker). Its MPN is kept and nothing is deleted. The import window shows these as "Class not kept".
- The class as the file wrote it is kept in `source_class`. Migration 0071 puts the parts already loaded into the five (Service, Equipment, and everything else the file called Parts and Filters as Parts). **Import the items file again to move the water filters** (196 parts) from Parts to Water Filters; the window shows each as "Class → Water Filters".
- Parts with no class (not from the file) are left alone and stay on the list.

**Description is the part name.** Written onto each kept MPN on Add and Update (all 3,972 parts from the file have one here). The Parts list and the invoice picker show part number (Name column), part name (Description) and class. The name is only the Description: with none, it is left blank, never the NetSuite item name. The "NetSuite item …" line is gone from the row.

**Account tabs: the five.** Details, Equipment, Tickets, Invoices, Pre-Inspection, one click each, only that category shown. Recipes were a sixth tab; they now sit at the bottom of Details.

**To confirm:**
- Dispensers: the file has no class or tab by that name, so no part is Dispensers yet. Nothing was guessed from the part names. Tell me which items are dispensers (a list, or a file) and they move there.
- Equipment includes the one "Equipment : Leases" row and Service includes Catering, Roasting and Training, because they sit on the Equipment and Service tabs.
- Where the "one long panel" was seen: there is one account window (Customers → an account), and it opens on the tabs. If it still looks stacked, the preview is on an older copy: pull main and restart.

Checked with clicks: import window on the real file after 0071: Update 197 (Class → Water Filters), Add 0; approved: Parts 3,431, Water Filters 196, Service 42, Equipment 303, Dispensers 0; the same file again changes nothing; 0 of 3,972 classed parts lack a Description. Picker for BWT8121 shows "BWT Bestmax L Filter, Part # BWT812113, Water Filters". Mod Coffeehouse: five tabs, one panel visible per tab.
